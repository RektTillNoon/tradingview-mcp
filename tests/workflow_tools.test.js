import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { registerWorkflowTools } from '../src/tools/workflows.js';

describe('workflow MCP tools', () => {
  it('registers the high-level workflow tool surface', () => {
    const registered = [];
    const server = {
      registerTool(name, config, handler) {
        registered.push({ name, description: config.description, schema: config.inputSchema, handler });
      },
    };

    registerWorkflowTools(server);

    assert.deepEqual(registered.map(tool => tool.name), [
      'tv_capabilities',
      'chart_snapshot',
      'strategy_scorecard',
      'alert_webhook_payload',
    ]);
    assert.ok(registered.every(tool => typeof tool.description === 'string' && tool.description.length > 20));
    assert.ok(registered.every(tool => typeof tool.handler === 'function'));
  });
});
