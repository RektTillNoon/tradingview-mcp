import { z } from 'zod';
import { registerJsonTool } from './_format.js';
import * as core from '../core/pine.js';

export function registerPineTools(server) {
  registerJsonTool(server, 'pine_get_source', 'Get current Pine Script source code from the editor', {}, () => core.getSource());

  registerJsonTool(server, 'pine_set_source', 'Set Pine Script source code in the editor', {
    source: z.string().describe('Pine Script source code to inject'),
  }, ({ source }) => core.setSource({ source }), { mutating: true });

  registerJsonTool(server, 'pine_compile', 'Compile / add the current Pine Script to the chart', {}, () => core.compile(), { mutating: true });

  registerJsonTool(server, 'pine_get_errors', 'Get Pine Script compilation errors from Monaco markers', {}, () => core.getErrors());

  registerJsonTool(server, 'pine_save', 'Save the current Pine Script (Ctrl+S)', {}, () => core.save(), { mutating: true });

  registerJsonTool(server, 'pine_get_console', 'Read Pine Script console/log output (compile messages, log.info(), errors)', {}, () => core.getConsole());

  registerJsonTool(server, 'pine_smart_compile', 'Intelligent compile: detects button, compiles, checks errors, reports study changes', {}, () => core.smartCompile(), { mutating: true });

  registerJsonTool(server, 'pine_new', 'Create a new blank Pine Script', {
    type: z.enum(['indicator', 'strategy', 'library']).describe('Type of script to create'),
  }, ({ type }) => core.newScript({ type }), { mutating: true });

  registerJsonTool(server, 'pine_open', 'Open a saved Pine Script by name', {
    name: z.string().describe('Name of the saved script to open (case-insensitive match)'),
  }, ({ name }) => core.openScript({ name }), { mutating: true });

  registerJsonTool(server, 'pine_list_scripts', 'List saved Pine Scripts', {}, () => core.listScripts());

  registerJsonTool(server, 'pine_analyze', 'Run static analysis on Pine Script code WITHOUT compiling — catches array out-of-bounds, unguarded array.first()/last(), bad loop bounds, repaint risks, and strategy quality issues. Works offline, no TradingView connection needed.', {
    source: z.string().describe('Pine Script source code to analyze'),
  }, ({ source }) => core.analyze({ source }));

  registerJsonTool(server, 'pine_check', 'Compile Pine Script via TradingView\'s server API without needing the chart open. Returns compilation errors/warnings. Useful for validating code before injecting into the chart.', {
    source: z.string().describe('Pine Script source code to compile/validate'),
  }, ({ source }) => core.check({ source }));
}
