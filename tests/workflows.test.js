import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAlertWebhookPayload,
  buildCapabilityReport,
  buildChartSnapshot,
  scoreStrategyResults,
} from '../src/core/workflows.js';

describe('workflow helpers', () => {
  it('buildCapabilityReport classifies available, degraded, and missing capabilities', () => {
    const report = buildCapabilityReport({
      discover: {
        paths: {
          chartApi: { available: true },
          replayApi: { available: false },
          pineFacadeApi: { available: true },
        },
      },
      target: {
        url: 'https://www.tradingview.com/chart/abc/',
        title: 'TradingView',
      },
    });

    assert.equal(report.success, true);
    assert.equal(report.mode, 'degraded');
    assert.equal(report.summary.available, 2);
    assert.equal(report.summary.missing, 1);
    assert.deepEqual(report.capabilities.replay, {
      status: 'missing',
      reason: 'replayApi unavailable',
    });
    assert.equal(report.target.url, 'https://www.tradingview.com/chart/abc/');
  });

  it('buildChartSnapshot creates one timestamped compact chart state', () => {
    const snapshot = buildChartSnapshot({
      capturedAt: '2026-04-30T12:00:00.000Z',
      state: {
        success: true,
        symbol: 'NASDAQ:AAPL',
        timeframe: '1D',
        chart_type: 'Candles',
        studies: [{ id: 'rsi-1', name: 'Relative Strength Index' }],
      },
      quote: { success: true, last: 214.25, volume: 1000 },
      ohlcv: { success: true, bar_count: 20, change_pct: '1.2%' },
      studyValues: { success: true, studies: [{ name: 'RSI', values: { RSI: 61.2 } }] },
      pineLines: { success: true, levels: [210, 220] },
      screenshot: { success: true, file_path: 'screenshots/chart.png' },
    });

    assert.equal(snapshot.success, true);
    assert.equal(snapshot.captured_at, '2026-04-30T12:00:00.000Z');
    assert.equal(snapshot.chart.symbol, 'NASDAQ:AAPL');
    assert.equal(snapshot.market.last, 214.25);
    assert.equal(snapshot.context.studies.length, 1);
    assert.equal(snapshot.artifacts.screenshot_path, 'screenshots/chart.png');
  });

  it('scoreStrategyResults grades strategy quality and flags overfit risks', () => {
    const scorecard = scoreStrategyResults({
      strategy: {
        success: true,
        metrics: {
          totalTrades: 18,
          netProfitPercent: 22,
          maxDrawdownPercent: 16,
          profitFactor: 1.25,
          percentProfitable: 45,
        },
      },
      trades: { success: true, trade_count: 18 },
      equity: { success: true, data_points: 40 },
    });

    assert.equal(scorecard.success, true);
    assert.equal(scorecard.grade, 'C');
    assert.equal(scorecard.risks.some(r => r.code === 'LOW_TRADE_COUNT'), true);
    assert.equal(scorecard.risks.some(r => r.code === 'WEAK_RETURN_TO_DRAWDOWN'), true);
    assert.ok(scorecard.score < 70);
  });

  it('scoreStrategyResults normalizes TradingView-style metric aliases', () => {
    const scorecard = scoreStrategyResults({
      strategy: {
        success: true,
        metrics: {
          'Total closed trades': '142',
          'Net profit %': '48.5%',
          'Max drawdown %': '9.2%',
          'Profit factor': '2.1',
          'Percent profitable': '57.4%',
        },
      },
      equity: { success: true, data_points: 250 },
    });

    assert.equal(scorecard.metrics.trade_count, 142);
    assert.equal(scorecard.metrics.net_profit_percent, 48.5);
    assert.equal(scorecard.metrics.max_drawdown_percent, 9.2);
    assert.equal(scorecard.metrics.profit_factor, 2.1);
    assert.equal(scorecard.metrics.win_rate_percent, 57.4);
    assert.equal(scorecard.grade, 'A');
  });

  it('buildAlertWebhookPayload returns stable execution-safe JSON fields', () => {
    const payload = buildAlertWebhookPayload({
      strategyId: 'confirmed-breakout-v1',
      symbol: 'BINANCE:BTCUSDT',
      timeframe: '15',
      side: 'long',
      action: 'entry',
      price: 64250.5,
      risk: { stop: 63500, target: 65750, size: 0.25 },
    });

    assert.deepEqual(Object.keys(payload).sort(), [
      'action',
      'generated_at',
      'price',
      'risk',
      'schema',
      'side',
      'strategy_id',
      'symbol',
      'timeframe',
    ]);
    assert.equal(payload.schema, 'tradingview-mcp.alert.v1');
    assert.equal(payload.risk.stop, 63500);
  });
});
