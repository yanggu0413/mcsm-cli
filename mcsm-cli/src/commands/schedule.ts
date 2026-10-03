import type { Command } from 'commander';
import type { CLIContext } from '../cli/context.js';
import { printOutput, printError } from '../output.js';
import { parseScheduleCount } from '../utils/validation.js';

interface ScheduleCreateOptions { type: string; count: string; }

export function registerScheduleCommands(program: Command, context: CLIContext): void {
  const { getClient } = context;
  const scheduleCmd = program.command('schedule').description('Manage scheduled tasks for an instance');

  scheduleCmd
    .command('list <daemonId> <uuid>')
    .description('List scheduled tasks of an instance')
    .action(async (daemonId: string, uuid: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.get('/api/protected_schedule', { daemonId, uuid });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  scheduleCmd
    .command('create <daemonId> <uuid> <name> <time> <actions...>')
    .description('Create a scheduled task (e.g. restart or terminal command)')
    .option('-t, --type <type>', 'Task type: 1 = Cron-like, 2 = Interval', '1')
    .option('-c, --count <count>', 'Execution count: -1 = repeat forever, N = times', '-1')
    .action(async (daemonId: string, uuid: string, name: string, time: string, actions: string[], opts: ScheduleCreateOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.post(
          '/api/protected_schedule',
          {
            name,
            time,
            actions,
            type: Number(opts.type) || 1,
            count: parseScheduleCount(opts.count),
          },
          { daemonId, uuid }
        );
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  scheduleCmd
    .command('rm <daemonId> <uuid> <name>')
    .description('Delete a scheduled task')
    .action(async (daemonId: string, uuid: string, name: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.delete('/api/protected_schedule', undefined, {
          daemonId,
          uuid,
          task_name: name,
        });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });
}
