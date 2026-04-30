import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerWorkflowTools } from '../src/tools/workflows.js';
import { registerResources } from '../src/resources.js';
import { registerPrompts } from '../src/prompts.js';

const toolsDir = new URL('../src/tools/', import.meta.url);

describe('MCP registration', () => {
  it('uses registerTool instead of legacy server.tool in every tool module', () => {
    const files = readdirSync(toolsDir)
      .filter(file => file.endsWith('.js') && file !== '_format.js');

    for (const file of files) {
      const source = readFileSync(join(toolsDir.pathname, file), 'utf8');
      assert.equal(source.includes('server.tool('), false, `${file} still uses server.tool`);
      assert.equal(
        source.includes('server.registerTool(') || source.includes('registerJsonTool('),
        true,
        `${file} should register through registerTool or registerJsonTool`,
      );
    }
  });

  it('workflow tools register with config-object schemas and annotations', () => {
    const registered = [];
    const server = {
      registerTool(name, config, handler) {
        registered.push({ name, config, handler });
      },
    };

    registerWorkflowTools(server);

    const snapshot = registered.find(tool => tool.name === 'chart_snapshot');
    const payload = registered.find(tool => tool.name === 'alert_webhook_payload');

    assert.ok(snapshot.config.inputSchema);
    assert.equal(snapshot.config.annotations.readOnlyHint, true);
    assert.equal(snapshot.config.annotations.idempotentHint, false);
    assert.ok(payload.config.inputSchema);
    assert.equal(payload.config.annotations.readOnlyHint, true);
  });

  it('registers MCP resources for workflow context', () => {
    const resources = [];
    const server = {
      registerResource(name, uri, metadata, handler) {
        resources.push({ name, uri, metadata, handler });
      },
    };

    registerResources(server);

    assert.deepEqual(resources.map(resource => resource.name), [
      'current-chart-snapshot',
      'capability-report',
      'current-pine-metadata',
      'latest-strategy-scorecard',
    ]);
    assert.ok(resources.every(resource => typeof resource.handler === 'function'));
  });

  it('registers MCP prompts for guided workflows', () => {
    const prompts = [];
    const server = {
      registerPrompt(name, config, handler) {
        prompts.push({ name, config, handler });
      },
    };

    registerPrompts(server);

    assert.deepEqual(prompts.map(prompt => prompt.name), [
      'analyze-chart',
      'debug-pine',
      'review-strategy-robustness',
      'prepare-alert-webhook',
    ]);
    assert.ok(prompts.every(prompt => prompt.config.argsSchema));
  });

  it('registers prompt arguments in the shape expected by the installed SDK', () => {
    const server = new McpServer({ name: 'test', version: '1.0.0' });

    registerPrompts(server);

    assert.deepEqual(Object.keys(server._registeredPrompts['analyze-chart'].argsSchema.shape), ['focus']);
    assert.deepEqual(Object.keys(server._registeredPrompts['debug-pine'].argsSchema.shape), ['issue']);
    assert.deepEqual(Object.keys(server._registeredPrompts['review-strategy-robustness'].argsSchema.shape), ['threshold']);
    assert.deepEqual(Object.keys(server._registeredPrompts['prepare-alert-webhook'].argsSchema.shape), [
      'strategyId',
      'symbol',
      'timeframe',
    ]);
  });
});
