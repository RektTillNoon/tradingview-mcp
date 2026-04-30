/**
 * CLI command router using node:util parseArgs.
 * Zero dependencies — uses only Node.js built-ins.
 */
import { parseArgs } from 'node:util';
import { blockedMutation, getSafetyMode, plannedMutation } from '../core/safety.js';

/** @type {Map<string, { description: string, options?: object, handler: Function, subcommands?: Map<string, object> }>} */
const commands = new Map();

const mutatingCommands = new Set(['launch']);
const mutatingSubcommands = new Map([
  ['pine', new Set(['set', 'compile', 'raw-compile', 'save', 'new', 'open'])],
  ['draw', new Set(['shape', 'remove', 'clear'])],
  ['alert', new Set(['create', 'delete'])],
  ['watchlist', new Set(['add'])],
  ['indicator', new Set(['add', 'remove', 'toggle', 'set'])],
  ['layout', new Set(['switch'])],
  ['pane', new Set(['layout', 'focus', 'symbol'])],
  ['tab', new Set(['new', 'close', 'switch'])],
  ['replay', new Set(['start', 'step', 'stop', 'autoplay', 'trade'])],
  ['ui', new Set(['click', 'keyboard', 'hover', 'scroll', 'eval', 'type', 'panel', 'fullscreen', 'mouse'])],
  ['data', new Set([])],
]);

export function register(name, config) {
  commands.set(name, config);
}

function isMutatingCommand(cmdName, subName, values = {}, positionals = []) {
  if (subName) return mutatingSubcommands.get(cmdName)?.has(subName) || false;
  if (['symbol', 'timeframe', 'type', 'scroll'].includes(cmdName)) return positionals.length > 0;
  if (cmdName === 'range') return Boolean(values.from && values.to);
  return mutatingCommands.has(cmdName);
}

function guardCliMutation(cmdName, subName, values, positionals) {
  if (!isMutatingCommand(cmdName, subName, values, positionals)) return false;
  const mode = getSafetyMode();
  const tool = subName ? `${cmdName} ${subName}` : cmdName;
  const args = { values, positionals };

  if (mode === 'read_only') {
    console.error(JSON.stringify(blockedMutation({ mode, tool, args }), null, 2));
    process.exit(1);
  }
  if (mode === 'confirm_mutations') {
    console.log(JSON.stringify(plannedMutation({ mode, tool, args }), null, 2));
    process.exit(0);
  }
  return false;
}

function printHelp() {
  console.log('Usage: tv <command> [options]\n');
  console.log('Commands:');
  const maxLen = Math.max(...[...commands.keys()].map(k => k.length));
  for (const [name, cmd] of commands) {
    if (cmd.subcommands) {
      const subs = [...cmd.subcommands.keys()].join(', ');
      console.log(`  ${name.padEnd(maxLen + 2)}${cmd.description}  [${subs}]`);
    } else {
      console.log(`  ${name.padEnd(maxLen + 2)}${cmd.description}`);
    }
  }
  console.log('\nRun "tv <command> --help" for command-specific options.');
  console.log('\nDISCLAIMER');
  console.log('  Not affiliated with TradingView Inc. or Anthropic, PBC.');
  console.log('  Use subject to TradingView\'s Terms of Use: tradingview.com/policies');
}

function printCommandHelp(name, cmd) {
  if (cmd.subcommands) {
    console.log(`Usage: tv ${name} <subcommand> [options]\n`);
    console.log('Subcommands:');
    for (const [sub, subConf] of cmd.subcommands) {
      console.log(`  ${sub.padEnd(12)}${subConf.description}`);
    }
  } else {
    console.log(`Usage: tv ${name} [options]\n`);
    console.log(cmd.description);
  }
  const opts = cmd.options || {};
  if (Object.keys(opts).length > 0) {
    console.log('\nOptions:');
    for (const [k, v] of Object.entries(opts)) {
      const flag = v.short ? `-${v.short}, --${k}` : `    --${k}`;
      console.log(`  ${flag.padEnd(20)}${v.description || ''}`);
    }
  }
}

export async function run(argv) {
  const args = argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  const cmdName = args[0];
  const cmd = commands.get(cmdName);

  if (!cmd) {
    console.error(`Unknown command: ${cmdName}`);
    console.error('Run "tv --help" for a list of commands.');
    process.exit(1);
  }

  // Handle subcommands (e.g., tv pine get)
  let handler, options;
  if (cmd.subcommands) {
    const subName = args[1];
    if (!subName || subName === '--help' || subName === '-h') {
      printCommandHelp(cmdName, cmd);
      process.exit(0);
    }
    const sub = cmd.subcommands.get(subName);
    if (!sub) {
      console.error(`Unknown subcommand: ${cmdName} ${subName}`);
      printCommandHelp(cmdName, cmd);
      process.exit(1);
    }
    handler = sub.handler;
    options = sub.options || {};
    // Parse remaining args after command + subcommand
    try {
      const { values, positionals } = parseArgs({
        args: args.slice(2),
        options: { help: { type: 'boolean', short: 'h' }, ...options },
        allowPositionals: true,
        strict: false,
      });
      if (values.help) {
        console.log(`Usage: tv ${cmdName} ${subName} [options]\n`);
        console.log(sub.description);
        if (Object.keys(options).length > 0) {
          console.log('\nOptions:');
          for (const [k, v] of Object.entries(options)) {
            const flag = v.short ? `-${v.short}, --${k}` : `    --${k}`;
            console.log(`  ${flag.padEnd(20)}${v.description || ''}`);
          }
        }
        process.exit(0);
      }
      guardCliMutation(cmdName, subName, values, positionals);
      await execute(handler, values, positionals);
    } catch (err) {
      handleError(err);
    }
  } else {
    handler = cmd.handler;
    options = cmd.options || {};
    try {
      const { values, positionals } = parseArgs({
        args: args.slice(1),
        options: { help: { type: 'boolean', short: 'h' }, ...options },
        allowPositionals: true,
        strict: false,
      });
      if (values.help) {
        printCommandHelp(cmdName, cmd);
        process.exit(0);
      }
      guardCliMutation(cmdName, null, values, positionals);
      await execute(handler, values, positionals);
    } catch (err) {
      handleError(err);
    }
  }
}

async function execute(handler, values, positionals) {
  try {
    const result = await handler(values, positionals);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    handleError(err);
  }
}

function handleError(err) {
  const message = err.message || String(err);
  // Connection failures get exit code 2
  if (/CDP|connection|ECONNREFUSED|not running/i.test(message)) {
    console.error(JSON.stringify({ success: false, error: message }, null, 2));
    process.exit(2);
  }
  console.error(JSON.stringify({ success: false, error: message }, null, 2));
  process.exit(1);
}
