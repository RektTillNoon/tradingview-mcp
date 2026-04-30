/**
 * Pure workflow helpers for higher-level agent operations.
 * These functions do not call TradingView/CDP directly, which keeps them
 * unit-testable and safe to reuse from MCP tools or CLI commands.
 */

const CAPABILITY_REQUIREMENTS = {
  chart_read: ['chartApi'],
  chart_control: ['chartApi'],
  pine_editor: ['bottomWidgetBar'],
  pine_server_check: ['pineFacadeApi'],
  replay: ['replayApi'],
  alerts: ['alertService'],
  layouts: ['chartWidgetCollection'],
};

function firstPresent(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '');
}

function numberFromMetrics(metrics, names) {
  const normalized = new Map();
  for (const [key, value] of Object.entries(metrics || {})) {
    normalized.set(String(key).toLowerCase().replace(/[^a-z0-9]/g, ''), value);
  }

  for (const name of names) {
    const value = metrics?.[name] ?? normalized.get(String(name).toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (value === undefined || value === null) continue;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/[%,$,\s]/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function capabilityStatus(paths, requirements) {
  const missing = requirements.filter(name => !paths?.[name]?.available);
  if (missing.length === 0) return { status: 'available' };
  return { status: 'missing', reason: `${missing.join(', ')} unavailable` };
}

export function buildCapabilityReport({ discover = {}, target = {}, checkedAt } = {}) {
  const paths = discover.apis || discover.paths || {};
  const capabilities = {};

  for (const [name, requirements] of Object.entries(CAPABILITY_REQUIREMENTS)) {
    capabilities[name] = capabilityStatus(paths, requirements);
  }

  const values = Object.values(paths);
  const available = values.filter(value => value?.available).length;
  const missing = Math.max(values.length - available, 0);
  const degradedCapabilities = Object.values(capabilities).filter(cap => cap.status !== 'available').length;

  return {
    success: true,
    checked_at: checkedAt || new Date().toISOString(),
    mode: degradedCapabilities === 0 ? 'full' : available > 0 ? 'degraded' : 'offline',
    summary: {
      available,
      missing,
      total: values.length,
      degraded_capabilities: degradedCapabilities,
    },
    target: {
      url: target.url || target.target_url || null,
      title: target.title || target.target_title || null,
    },
    capabilities,
    raw_paths: paths,
  };
}

export function buildChartSnapshot({
  capturedAt,
  state = {},
  quote = {},
  ohlcv = {},
  studyValues = {},
  pineLines,
  pineLabels,
  pineTables,
  pineBoxes,
  screenshot,
} = {}) {
  return {
    success: true,
    captured_at: capturedAt || new Date().toISOString(),
    chart: {
      symbol: firstPresent(state.symbol, state.chart_symbol, quote.symbol, null),
      timeframe: firstPresent(state.timeframe, state.resolution, state.chart_resolution, null),
      chart_type: firstPresent(state.chart_type, state.chartType, null),
      studies: state.studies || [],
    },
    market: {
      last: firstPresent(quote.last, quote.close, null),
      open: firstPresent(quote.open, null),
      high: firstPresent(quote.high, null),
      low: firstPresent(quote.low, null),
      volume: firstPresent(quote.volume, null),
      ohlcv_summary: ohlcv?.success === false ? null : ohlcv,
    },
    context: {
      studies: studyValues.studies || studyValues.values || [],
      pine_lines: pineLines || null,
      pine_labels: pineLabels || null,
      pine_tables: pineTables || null,
      pine_boxes: pineBoxes || null,
    },
    artifacts: {
      screenshot_path: firstPresent(screenshot?.path, screenshot?.file_path, screenshot?.file, screenshot?.filename, null),
    },
  };
}

export function scoreStrategyResults({ strategy = {}, trades = {}, equity = {} } = {}) {
  const metrics = strategy.metrics || {};
  const tradeCount = firstPresent(
    numberFromMetrics(metrics, ['totalTrades', 'total_trades', 'Total Trades', 'Total closed trades']),
    trades.trade_count,
    null,
  );
  const netProfitPct = numberFromMetrics(metrics, [
    'netProfitPercent',
    'net_profit_percent',
    'Net Profit %',
    'Net profit %',
    'netProfit',
    'Net Profit',
  ]);
  const maxDrawdownPct = numberFromMetrics(metrics, [
    'maxDrawdownPercent',
    'max_drawdown_percent',
    'Max Drawdown %',
    'Max drawdown %',
    'maxDrawdown',
    'Max Drawdown',
  ]);
  const profitFactor = numberFromMetrics(metrics, ['profitFactor', 'profit_factor', 'Profit Factor']);
  const winRate = numberFromMetrics(metrics, [
    'percentProfitable',
    'percent_profitable',
    'Percent Profitable',
    'Percent profitable',
    'Win Rate',
    'winRate',
  ]);

  let score = 65;
  const risks = [];
  const strengths = [];

  if (tradeCount !== null) {
    if (tradeCount < 30) {
      score -= 10;
      risks.push({ code: 'LOW_TRADE_COUNT', message: 'Fewer than 30 trades; sample is too small for confidence.' });
    } else if (tradeCount >= 100) {
      score += 10;
      strengths.push({ code: 'ENOUGH_TRADES', message: 'Trade count is large enough for a first-pass read.' });
    } else {
      score += 3;
    }
  }

  if (profitFactor !== null) {
    if (profitFactor < 1.2) {
      score -= 12;
      risks.push({ code: 'LOW_PROFIT_FACTOR', message: 'Profit factor is weak.' });
    } else if (profitFactor >= 1.8) {
      score += 18;
      strengths.push({ code: 'STRONG_PROFIT_FACTOR', message: 'Profit factor is strong.' });
    } else {
      score += 4;
    }
  }

  if (winRate !== null) {
    if (winRate < 40) {
      score -= 8;
      risks.push({ code: 'LOW_WIN_RATE', message: 'Win rate is low; verify payoff asymmetry is intentional.' });
    } else if (winRate >= 55) {
      score += 8;
      strengths.push({ code: 'HEALTHY_WIN_RATE', message: 'Win rate is healthy.' });
    }
  }

  if (netProfitPct !== null && maxDrawdownPct !== null && maxDrawdownPct > 0) {
    const returnToDrawdown = netProfitPct / maxDrawdownPct;
    if (returnToDrawdown < 2) {
      score -= 7;
      risks.push({ code: 'WEAK_RETURN_TO_DRAWDOWN', message: 'Net profit is less than 2x max drawdown.' });
    } else if (returnToDrawdown >= 4) {
      score += 16;
      strengths.push({ code: 'STRONG_RETURN_TO_DRAWDOWN', message: 'Return to drawdown ratio is strong.' });
    } else {
      score += 4;
    }
  }

  if ((equity.data_points ?? 0) > 0 && equity.data_points < 50) {
    score -= 2;
    risks.push({ code: 'SPARSE_EQUITY_CURVE', message: 'Equity curve has limited data points.' });
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const grade = boundedScore >= 85 ? 'A'
    : boundedScore >= 70 ? 'B'
      : boundedScore >= 50 ? 'C'
        : boundedScore >= 35 ? 'D'
          : 'F';

  return {
    success: true,
    score: boundedScore,
    grade,
    metrics: {
      trade_count: tradeCount,
      net_profit_percent: netProfitPct,
      max_drawdown_percent: maxDrawdownPct,
      profit_factor: profitFactor,
      win_rate_percent: winRate,
    },
    risks,
    strengths,
    recommendation: boundedScore >= 70
      ? 'Candidate is worth deeper out-of-sample and multi-market testing.'
      : 'Do not trust this strategy yet; improve robustness before relying on it.',
  };
}

export function buildAlertWebhookPayload({
  strategyId,
  symbol,
  timeframe,
  side,
  action,
  price,
  risk = {},
  generatedAt,
} = {}) {
  if (!strategyId) throw new Error('strategyId is required');
  if (!symbol) throw new Error('symbol is required');
  if (!timeframe) throw new Error('timeframe is required');
  if (!['long', 'short', 'flat'].includes(side)) throw new Error('side must be long, short, or flat');
  if (!['entry', 'exit', 'update', 'cancel'].includes(action)) throw new Error('action must be entry, exit, update, or cancel');

  return {
    schema: 'tradingview-mcp.alert.v1',
    strategy_id: strategyId,
    symbol,
    timeframe,
    side,
    action,
    price: price === undefined || price === null ? null : Number(price),
    risk: {
      stop: risk.stop === undefined ? null : Number(risk.stop),
      target: risk.target === undefined ? null : Number(risk.target),
      size: risk.size === undefined ? null : Number(risk.size),
    },
    generated_at: generatedAt || new Date().toISOString(),
  };
}
