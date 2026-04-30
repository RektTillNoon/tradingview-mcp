import { register } from '../router.js';
import * as chart from '../../core/chart.js';
import * as data from '../../core/data.js';
import * as health from '../../core/health.js';
import * as capture from '../../core/capture.js';
import {
  buildAlertWebhookPayload,
  buildCapabilityReport,
  buildChartSnapshot,
  scoreStrategyResults,
} from '../../core/workflows.js';

async function optionalCall(fn) {
  try {
    return await fn();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

register('capabilities', {
  description: 'Summarize TradingView internal API capabilities',
  handler: async () => {
    const [discover, target] = await Promise.all([
      health.discover(),
      optionalCall(() => health.healthCheck()),
    ]);
    return buildCapabilityReport({ discover, target });
  },
});

register('snapshot', {
  description: 'Capture a compact timestamped chart snapshot',
  options: {
    bars: { type: 'string', short: 'n', description: 'Number of bars for OHLCV summary' },
    filter: { type: 'string', short: 'f', description: 'Pine study name filter' },
    pine: { type: 'boolean', description: 'Include Pine graphics data' },
    screenshot: { type: 'boolean', description: 'Include chart screenshot path' },
  },
  handler: async (opts) => {
    const shouldReadPineGraphics = opts.pine || Boolean(opts.filter);
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
      optionalCall(() => data.getOhlcv({ count: opts.bars ? Number(opts.bars) : undefined, summary: true })),
      optionalCall(() => data.getStudyValues()),
      shouldReadPineGraphics ? optionalCall(() => data.getPineLines({ study_filter: opts.filter })) : Promise.resolve(null),
      shouldReadPineGraphics ? optionalCall(() => data.getPineLabels({ study_filter: opts.filter })) : Promise.resolve(null),
      shouldReadPineGraphics ? optionalCall(() => data.getPineTables({ study_filter: opts.filter })) : Promise.resolve(null),
      shouldReadPineGraphics ? optionalCall(() => data.getPineBoxes({ study_filter: opts.filter })) : Promise.resolve(null),
      opts.screenshot ? optionalCall(() => capture.captureScreenshot({ region: 'chart' })) : Promise.resolve(null),
    ]);

    return buildChartSnapshot({
      state,
      quote,
      ohlcv,
      studyValues,
      pineLines,
      pineLabels,
      pineTables,
      pineBoxes,
      screenshot,
    });
  },
});

register('scorecard', {
  description: 'Score current Strategy Tester results for robustness',
  handler: async () => {
    const [strategy, trades, equity] = await Promise.all([
      optionalCall(() => data.getStrategyResults()),
      optionalCall(() => data.getTrades({ max_trades: 100 })),
      optionalCall(() => data.getEquity()),
    ]);
    return scoreStrategyResults({ strategy, trades, equity });
  },
});

register('alert-payload', {
  description: 'Build stable JSON for a TradingView alert webhook',
  options: {
    'strategy-id': { type: 'string', description: 'Stable strategy identifier' },
    symbol: { type: 'string', description: 'TradingView symbol' },
    timeframe: { type: 'string', description: 'TradingView timeframe/resolution' },
    side: { type: 'string', description: 'long, short, or flat' },
    action: { type: 'string', description: 'entry, exit, update, or cancel' },
    price: { type: 'string', description: 'Optional signal price' },
    stop: { type: 'string', description: 'Optional stop price' },
    target: { type: 'string', description: 'Optional target price' },
    size: { type: 'string', description: 'Optional position size' },
  },
  handler: (opts) => buildAlertWebhookPayload({
    strategyId: opts['strategy-id'],
    symbol: opts.symbol,
    timeframe: opts.timeframe,
    side: opts.side,
    action: opts.action,
    price: opts.price,
    risk: {
      stop: opts.stop,
      target: opts.target,
      size: opts.size,
    },
  }),
});
