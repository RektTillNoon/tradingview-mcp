import { z } from 'zod';
import { jsonResult, registerJsonTool } from './_format.js';
import { readOnlyAnnotations } from '../core/safety.js';
import * as chart from '../core/chart.js';
import * as data from '../core/data.js';
import * as health from '../core/health.js';
import * as capture from '../core/capture.js';
import {
  buildAlertWebhookPayload,
  buildCapabilityReport,
  buildChartSnapshot,
  scoreStrategyResults,
} from '../core/workflows.js';

async function optionalCall(fn) {
  try {
    return await fn();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function registerWorkflowTools(server) {
  registerJsonTool(server, 'tv_capabilities', 'Summarize TradingView internal API availability into a capability report with degraded tool groups and repair hints.', {}, async () => {
    const [discover, target] = await Promise.all([
      health.discover(),
      optionalCall(() => health.healthCheck()),
    ]);
    return buildCapabilityReport({ discover, target });
  });

  server.registerTool('chart_snapshot', {
    description: 'Capture one coherent, timestamped chart state for agent reasoning: chart state, quote, compact OHLCV, study values, optional Pine graphics, and optional screenshot path.',
    inputSchema: z.object({
      bars: z.coerce.number().optional().describe('Number of bars for compact OHLCV summary (default 100, max 500)'),
      study_filter: z.string().optional().describe('Optional Pine study name filter for line/label/table/box extraction'),
      include_pine_graphics: z.coerce.boolean().optional().describe('Include Pine line/label/table/box data. Default false unless study_filter is provided.'),
      include_screenshot: z.coerce.boolean().optional().describe('Capture a chart screenshot and include its file path. Default false.'),
    }),
    annotations: { ...readOnlyAnnotations, idempotentHint: false },
  }, async ({ bars, study_filter, include_pine_graphics, include_screenshot }) => {
    try {
      const shouldReadPineGraphics = include_pine_graphics || Boolean(study_filter);
      const [
        state,
        quote,
        ohlcv,
        studyValues,
        pineLines,
        pineLabels,
        pineTables,
        pineBoxes,
        screenshot,
      ] = await Promise.all([
        optionalCall(() => chart.getState()),
        optionalCall(() => data.getQuote()),
        optionalCall(() => data.getOhlcv({ count: bars, summary: true })),
        optionalCall(() => data.getStudyValues()),
        shouldReadPineGraphics ? optionalCall(() => data.getPineLines({ study_filter })) : Promise.resolve(null),
        shouldReadPineGraphics ? optionalCall(() => data.getPineLabels({ study_filter })) : Promise.resolve(null),
        shouldReadPineGraphics ? optionalCall(() => data.getPineTables({ study_filter })) : Promise.resolve(null),
        shouldReadPineGraphics ? optionalCall(() => data.getPineBoxes({ study_filter })) : Promise.resolve(null),
        include_screenshot ? optionalCall(() => capture.captureScreenshot({ region: 'chart' })) : Promise.resolve(null),
      ]);

      return jsonResult(buildChartSnapshot({
        state,
        quote,
        ohlcv,
        studyValues,
        pineLines,
        pineLabels,
        pineTables,
        pineBoxes,
        screenshot,
      }));
    } catch (err) {
      return jsonResult({ success: false, error: err.message }, true);
    }
  });

  registerJsonTool(server, 'strategy_scorecard', 'Read Strategy Tester metrics/trades/equity and return an operator-grade scorecard with robustness risks and next recommendation.', {}, async () => {
    const [strategy, trades, equity] = await Promise.all([
      optionalCall(() => data.getStrategyResults()),
      optionalCall(() => data.getTrades({ max_trades: 100 })),
      optionalCall(() => data.getEquity()),
    ]);

    return scoreStrategyResults({ strategy, trades, equity });
  });

  registerJsonTool(server, 'alert_webhook_payload', 'Prepare a stable JSON webhook payload for TradingView alerts with explicit strategy, symbol, timeframe, side, action, price, and risk fields.', {
    strategyId: z.string().describe('Stable strategy identifier, for example confirmed-breakout-v1'),
    symbol: z.string().describe('TradingView symbol, for example BINANCE:BTCUSDT'),
    timeframe: z.string().describe('TradingView timeframe/resolution, for example 15 or 1D'),
    side: z.enum(['long', 'short', 'flat']).describe('Position side signaled by the alert'),
    action: z.enum(['entry', 'exit', 'update', 'cancel']).describe('Action represented by the alert'),
    price: z.coerce.number().optional().describe('Signal price, if known'),
    stop: z.coerce.number().optional().describe('Optional stop price'),
    target: z.coerce.number().optional().describe('Optional target price'),
    size: z.coerce.number().optional().describe('Optional position size'),
  }, ({ strategyId, symbol, timeframe, side, action, price, stop, target, size }) => buildAlertWebhookPayload({
    strategyId,
    symbol,
    timeframe,
    side,
    action,
    price,
    risk: { stop, target, size },
  }));
}
