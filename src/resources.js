import * as chart from './core/chart.js';
import * as data from './core/data.js';
import * as health from './core/health.js';
import * as pine from './core/pine.js';
import {
  buildCapabilityReport,
  buildChartSnapshot,
  scoreStrategyResults,
} from './core/workflows.js';

async function optionalCall(fn) {
  try {
    return await fn();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function jsonResource(uri, value) {
  return {
    contents: [{
      uri: uri.href,
      mimeType: 'application/json',
      text: JSON.stringify(value, null, 2),
    }],
  };
}

export function registerResources(server) {
  server.registerResource(
    'current-chart-snapshot',
    'tradingview://chart/current-snapshot',
    { title: 'Current Chart Snapshot', description: 'Compact current chart state for analysis.' },
    async (uri) => {
      const [state, quote, ohlcv, studyValues] = await Promise.all([
        optionalCall(() => chart.getState()),
        optionalCall(() => data.getQuote()),
        optionalCall(() => data.getOhlcv({ summary: true })),
        optionalCall(() => data.getStudyValues()),
      ]);
      return jsonResource(uri, buildChartSnapshot({ state, quote, ohlcv, studyValues }));
    },
  );

  server.registerResource(
    'capability-report',
    'tradingview://bridge/capabilities',
    { title: 'TradingView Bridge Capabilities', description: 'Available and degraded TradingView internal APIs.' },
    async (uri) => {
      const [discover, target] = await Promise.all([
        optionalCall(() => health.discover()),
        optionalCall(() => health.healthCheck()),
      ]);
      return jsonResource(uri, buildCapabilityReport({ discover, target }));
    },
  );

  server.registerResource(
    'current-pine-metadata',
    'tradingview://pine/current-metadata',
    { title: 'Current Pine Metadata', description: 'Current Pine source metadata without exposing full source by default.' },
    async (uri) => {
      const sourceResult = await optionalCall(() => pine.getSource());
      const source = sourceResult?.source || '';
      return jsonResource(uri, {
        success: sourceResult.success !== false,
        available: Boolean(source),
        line_count: source ? source.split('\n').length : 0,
        char_count: source.length,
        error: sourceResult.error,
      });
    },
  );

  server.registerResource(
    'latest-strategy-scorecard',
    'tradingview://strategy/latest-scorecard',
    { title: 'Latest Strategy Scorecard', description: 'Strategy Tester scorecard from current chart.' },
    async (uri) => {
      const [strategy, trades, equity] = await Promise.all([
        optionalCall(() => data.getStrategyResults()),
        optionalCall(() => data.getTrades({ max_trades: 100 })),
        optionalCall(() => data.getEquity()),
      ]);
      return jsonResource(uri, scoreStrategyResults({ strategy, trades, equity }));
    },
  );
}
