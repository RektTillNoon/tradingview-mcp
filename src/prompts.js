import { z } from 'zod';

function userPrompt(text) {
  return {
    messages: [{
      role: 'user',
      content: { type: 'text', text },
    }],
  };
}

export function registerPrompts(server) {
  server.registerPrompt(
    'analyze-chart',
    {
      title: 'Analyze Chart',
      description: 'Guide an agent through a compact chart analysis workflow.',
      argsSchema: {
        focus: z.string().optional().describe('Optional analysis focus, such as trend, levels, or setup quality.'),
      },
    },
    ({ focus }) => userPrompt(`Use chart_snapshot with include_screenshot=true, then analyze the current chart${focus ? ` with focus on ${focus}` : ''}. Reference captured_at and separate observed data from interpretation.`),
  );

  server.registerPrompt(
    'debug-pine',
    {
      title: 'Debug Pine',
      description: 'Guide Pine Script diagnosis and compile iteration.',
      argsSchema: {
        issue: z.string().optional().describe('Known user-facing issue or compile error.'),
      },
    },
    ({ issue }) => userPrompt(`Use pine_analyze first, then pine_check or pine_smart_compile when appropriate. Fix the Pine Script with minimal semantic change${issue ? ` for this issue: ${issue}` : ''}.`),
  );

  server.registerPrompt(
    'review-strategy-robustness',
    {
      title: 'Review Strategy Robustness',
      description: 'Guide strategy scorecard interpretation.',
      argsSchema: {
        threshold: z.string().optional().describe('Optional target threshold or risk tolerance.'),
      },
    },
    ({ threshold }) => userPrompt(`Use strategy_scorecard and explain whether the current strategy is robust enough to trust${threshold ? ` under this threshold: ${threshold}` : ''}. Call out overfit risks and next validation steps.`),
  );

  server.registerPrompt(
    'prepare-alert-webhook',
    {
      title: 'Prepare Alert Webhook',
      description: 'Guide alert webhook payload generation.',
      argsSchema: {
        strategyId: z.string().describe('Stable strategy identifier.'),
        symbol: z.string().describe('TradingView symbol.'),
        timeframe: z.string().describe('TradingView timeframe.'),
      },
    },
    ({ strategyId, symbol, timeframe }) => userPrompt(`Use alert_webhook_payload to prepare alert JSON for strategyId=${strategyId}, symbol=${symbol}, timeframe=${timeframe}. Keep the payload stable and execution-safe.`),
  );
}
