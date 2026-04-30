import { z } from 'zod';
import { registerJsonTool } from './_format.js';
import * as core from '../core/health.js';

export function registerHealthTools(server) {
  registerJsonTool(server, 'tv_health_check', 'Check CDP connection to TradingView and return current chart state', {}, () => core.healthCheck());

  registerJsonTool(server, 'tv_discover', 'Report which known TradingView API paths are available and their methods', {}, () => core.discover());

  registerJsonTool(server, 'tv_ui_state', 'Get current UI state: which panels are open, what buttons are visible/enabled/disabled', {}, () => core.uiState());

  registerJsonTool(server, 'tv_launch', 'Launch TradingView Desktop with Chrome DevTools Protocol (remote debugging) enabled. Auto-detects install location on Mac, Windows, and Linux.', {
    port: z.coerce.number().optional().describe('CDP port (default 9222)'),
    kill_existing: z.coerce.boolean().optional().describe('Kill existing TradingView instances first (default true)'),
  }, ({ port, kill_existing }) => core.launch({ port, kill_existing }), { mutating: true });
}
