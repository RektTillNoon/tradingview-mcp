import { z } from 'zod';
import { registerJsonTool } from './_format.js';
import * as core from '../core/replay.js';

export function registerReplayTools(server) {
  registerJsonTool(server, 'replay_start', 'Start bar replay mode, optionally at a specific date', {
    date: z.string().optional().describe('Date to start replay from (YYYY-MM-DD format). If omitted, selects first available date.'),
  }, ({ date }) => core.start({ date }), { mutating: true });

  registerJsonTool(server, 'replay_step', 'Advance one bar in replay mode', {}, () => core.step(), { mutating: true });

  registerJsonTool(server, 'replay_autoplay', 'Toggle autoplay in replay mode, optionally set speed', {
    speed: z.coerce.number().optional().describe('Autoplay delay in ms (lower = faster). Valid values: 100, 143, 200, 300, 1000, 2000, 3000, 5000, 10000. Leave empty to just toggle.'),
  }, ({ speed }) => core.autoplay({ speed }), { mutating: true });

  registerJsonTool(server, 'replay_stop', 'Stop replay and return to realtime', {}, () => core.stop(), { mutating: true });

  registerJsonTool(server, 'replay_trade', 'Execute a trade action in replay mode (buy, sell, or close position)', {
    action: z.string().describe('Trade action: buy, sell, or close'),
  }, ({ action }) => core.trade({ action }), { mutating: true });

  registerJsonTool(server, 'replay_status', 'Get current replay mode status', {}, () => core.status());
}
