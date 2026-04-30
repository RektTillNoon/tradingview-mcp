import { z } from 'zod';
import { registerJsonTool } from './_format.js';
import * as core from '../core/watchlist.js';

export function registerWatchlistTools(server) {
  registerJsonTool(server, 'watchlist_get', 'Get all symbols from the current TradingView watchlist with last price, change, and change%', {}, () => core.get());

  registerJsonTool(server, 'watchlist_add', 'Add a symbol to the TradingView watchlist', {
    symbol: z.string().describe('Symbol to add (e.g., AAPL, BTCUSD, ES1!, NYMEX:CL1!)'),
  }, async ({ symbol }) => {
    try {
      return await core.add({ symbol });
    } catch (err) {
      try { await core.cleanupWatchlistSearch(); } catch (_) {}
      throw err;
    }
  }, { mutating: true });
}
