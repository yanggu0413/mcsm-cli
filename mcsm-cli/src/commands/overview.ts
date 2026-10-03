import type { Command } from 'commander';
import type { CLIContext } from '../cli/context.js';
import { printOutput, printError } from '../output.js';

export function registerOverviewCommands(program: Command, context: CLIContext): void {
  const { getClient } = context;
  program
    .command('overview')
    .description('Get panel overview, system resources, and node statistics')
    .action(async () => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.get('/api/overview');
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });
}
