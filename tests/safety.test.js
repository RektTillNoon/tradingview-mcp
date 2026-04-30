import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getSafetyMode,
  guardMutation,
  mutationAnnotations,
  readOnlyAnnotations,
} from '../src/core/safety.js';
import { cleanupWatchlistSearch } from '../src/core/watchlist.js';

describe('safety mode', () => {
  it('defaults to full_control', () => {
    assert.equal(getSafetyMode({}), 'full_control');
  });

  it('blocks mutating operations in read_only mode', async () => {
    let executed = false;
    const result = await guardMutation({
      tool: 'chart_set_symbol',
      args: { symbol: 'AAPL' },
      env: { TV_MCP_MODE: 'read_only' },
      execute: async () => {
        executed = true;
        return { success: true };
      },
    });

    assert.equal(executed, false);
    assert.equal(result.blocked, true);
    assert.equal(result.mode, 'read_only');
    assert.equal(result.tool, 'chart_set_symbol');
  });

  it('returns a planned action in confirm_mutations mode', async () => {
    let executed = false;
    const result = await guardMutation({
      tool: 'draw_shape',
      args: { shape: 'horizontal_line' },
      env: { TV_MCP_MODE: 'confirm_mutations' },
      execute: async () => {
        executed = true;
        return { success: true };
      },
    });

    assert.equal(executed, false);
    assert.equal(result.blocked, false);
    assert.equal(result.requires_confirmation, true);
    assert.equal(result.mode, 'confirm_mutations');
  });

  it('executes mutations in full_control mode', async () => {
    const result = await guardMutation({
      tool: 'alert_create',
      args: { price: 100 },
      env: { TV_MCP_MODE: 'full_control' },
      execute: async () => ({ success: true, created: true }),
    });

    assert.deepEqual(result, { success: true, created: true });
  });

  it('exposes MCP annotations for read and mutation tools', () => {
    assert.equal(readOnlyAnnotations.readOnlyHint, true);
    assert.equal(readOnlyAnnotations.idempotentHint, true);
    assert.equal(mutationAnnotations.readOnlyHint, false);
    assert.equal(mutationAnnotations.destructiveHint, false);
  });

  it('watchlist cleanup dismisses an open symbol search after add failures', async () => {
    const events = [];
    const fakeClient = {
      Input: {
        dispatchKeyEvent: async (event) => events.push(event),
      },
    };

    await cleanupWatchlistSearch(async () => fakeClient);

    assert.deepEqual(events.map(event => event.type), ['keyDown', 'keyUp']);
    assert.deepEqual(events.map(event => event.key), ['Escape', 'Escape']);
  });
});
