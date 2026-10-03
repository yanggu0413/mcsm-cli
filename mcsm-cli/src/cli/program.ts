import { Command } from 'commander';
import { createRequire } from 'node:module';
import { createContext, type CLIDependencies } from './context.js';
import { printError } from '../output.js';
import { registerConfigCommands } from '../commands/config.js';
import { registerOverviewCommands } from '../commands/overview.js';
import { registerDaemonCommands } from '../commands/daemon.js';
import { registerInstanceCommands } from '../commands/instance/index.js';
import { registerFileCommands } from '../commands/file/index.js';
import { registerUserCommands } from '../commands/user.js';
import { registerModCommands } from '../commands/mod.js';
import { registerScheduleCommands } from '../commands/schedule.js';
import { registerJavaCommands } from '../commands/java.js';

export function createProgram(dependencies: CLIDependencies = {}): Command {
  const require = createRequire(import.meta.url);
  const metadata = require('../../package.json') as { version: string };
  const program = new Command();
  const context = createContext(program, dependencies);
  program
    .name('mcsm')
    .description('MCSManager CLI & AI Agent toolsuite')
    .version(metadata.version)
    .option('-u, --url <url>', 'MCSManager panel URL (e.g. http://localhost:23333)')
    .option('-k, --key <key>', 'MCSManager API Key')
    .option('-j, --json', 'Output raw JSON for script/agent parsing', false);

  program.exitOverride();
  program.configureOutput({
    writeErr(message) {
      if (context.isJsonRequested()) {
        const clean = message.replace(/^error:\s*/i, '').trim();
        if (clean) printError(new Error(clean), true);
      } else {
        process.stderr.write(message);
      }
    },
  });
  const parseAsync = program.parseAsync.bind(program);
  program.parseAsync = (argv, options) => {
    context.setArgs(argv ?? process.argv);
    return parseAsync(argv, options);
  };

  registerConfigCommands(program, context);
  registerOverviewCommands(program, context);
  registerDaemonCommands(program, context);
  registerInstanceCommands(program, context);
  registerFileCommands(program, context);
  registerUserCommands(program, context);
  registerModCommands(program, context);
  registerScheduleCommands(program, context);
  registerJavaCommands(program, context);
  return program;
}
