import { z } from 'zod';
import { registerJsonTool } from './_format.js';
import * as core from '../core/tab.js';

export function registerTabTools(server) {
  registerJsonTool(server, 'tab_list', 'List all open TradingView chart tabs', {}, () => core.list());

  registerJsonTool(server, 'tab_new', 'Open a new chart tab', {}, () => core.newTab(), { mutating: true });

  registerJsonTool(server, 'tab_close', 'Close the current chart tab', {}, () => core.closeTab(), { mutating: true });

  registerJsonTool(server, 'tab_switch', 'Switch to a chart tab by index', {
    index: z.coerce.number().describe('Tab index (0-based, from tab_list)'),
  }, ({ index }) => core.switchTab({ index }), { mutating: true });
}
