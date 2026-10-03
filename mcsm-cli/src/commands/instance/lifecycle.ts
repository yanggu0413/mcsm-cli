import type { Command } from 'commander';
import type { CLIContext } from '../../cli/context.js';
import { printOutput, printError } from '../../output.js';
import { validateNoNewlines, normalizeLogSize } from '../../utils/validation.js';

interface InstanceLogOptions { size: string; }

export function registerLifecycleCommands(instanceCmd: Command, context: CLIContext): void {
  const { getClient } = context;
  instanceCmd
    .command('start <daemonId> <uuid>')
    .description('Start an instance')
    .action(async (daemonId: string, uuid: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.get('/api/protected_instance/open', { daemonId, uuid });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  instanceCmd
    .command('stop <daemonId> <uuid>')
    .description('Gracefully stop an instance')
    .action(async (daemonId: string, uuid: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.get('/api/protected_instance/stop', { daemonId, uuid });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  instanceCmd
    .command('restart <daemonId> <uuid>')
    .description('Restart an instance')
    .action(async (daemonId: string, uuid: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.get('/api/protected_instance/restart', { daemonId, uuid });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  instanceCmd
    .command('kill <daemonId> <uuid>')
    .description('Forcefully kill an instance process (Warning: may corrupt world saves)')
    .action(async (daemonId: string, uuid: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.get('/api/protected_instance/kill', { daemonId, uuid });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  instanceCmd
    .command('cmd <daemonId> <uuid> <commandText...>')
    .description('Send a terminal command string into the running instance')
    .action(async (daemonId: string, uuid: string, commandText: string[]) => {
      const { mcsm, isJson } = getClient();
      try {
        const command = commandText.join(' ');
        validateNoNewlines(command);

        // Use POST with query parameters to avoid logging sensitive commands in GET query logs
        const data = await mcsm.post(
          '/api/protected_instance/command',
          { command },
          { daemonId, uuid, command }
        );
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  instanceCmd
    .command('log <daemonId> <uuid>')
    .description('Get console output log from an instance')
    .option('-s, --size <size>', 'Log size limit (default: 20KB, max: 100KB)', '20KB')
    .action(async (daemonId: string, uuid: string, opts: InstanceLogOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        const sizeStr = normalizeLogSize(opts.size);
        const data = await mcsm.get('/api/protected_instance/outputlog', {
          daemonId,
          uuid,
          size: sizeStr,
        });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });
}
