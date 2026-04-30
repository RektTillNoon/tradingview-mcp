import { z } from 'zod';
import { registerJsonTool } from './_format.js';
import * as core from '../core/alerts.js';

export function registerAlertTools(server) {
  registerJsonTool(server, 'alert_create', 'Create a price alert via the TradingView alert dialog', {
    condition: z.string().describe('Alert condition (e.g., "crossing", "greater_than", "less_than")'),
    price: z.coerce.number().describe('Price level for the alert'),
    message: z.string().optional().describe('Alert message'),
  }, ({ condition, price, message }) => core.create({ condition, price, message }), { mutating: true });

  registerJsonTool(server, 'alert_list', 'List active alerts', {}, () => core.list());

  registerJsonTool(server, 'alert_delete', 'Delete all alerts or open context menu for deletion', {
    delete_all: z.coerce.boolean().optional().describe('Delete all alerts'),
  }, ({ delete_all }) => core.deleteAlerts({ delete_all }), { mutating: true });
}
