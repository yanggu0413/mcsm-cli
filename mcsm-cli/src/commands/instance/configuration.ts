import type { Command } from 'commander';
import type { CLIContext } from '../../cli/context.js';
import { printOutput, printError } from '../../output.js';
import fs from 'fs';
import { clampPageSize } from '../../utils/pagination.js';
import { validateSafePath } from '../../utils/paths.js';

interface InstanceListOptions { page: string; pageSize: string; name?: string; status?: string; }
interface InstanceCreateOptions { file?: string; name?: string; cmd?: string; cwd?: string; }
interface InstanceUpdateOptions { file?: string; }
interface InstanceDeleteOptions { deleteFile: boolean; }

export function registerConfigurationCommands(instanceCmd: Command, context: CLIContext): void {
  const { getClient } = context;
  instanceCmd
    .command('list <daemonId>')
    .description('List instances on a specific daemon node')
    .option('-p, --page <page>', 'Page number', '1')
    .option('-s, --page-size <pageSize>', 'Page size (1-50)', '20')
    .option('-n, --name <name>', 'Filter by instance nickname')
    .option('--status <status>', 'Filter by status code (-1=busy, 0=stopped, 1=stopping, 2=starting, 3=running)')
    .action(async (daemonId: string, opts: InstanceListOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.get('/api/service/remote_service_instances', {
          daemonId,
          page: Number(opts.page) || 1,
          page_size: clampPageSize(opts.pageSize, 20, 50),
          instance_name: opts.name,
          status: opts.status,
        });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  instanceCmd
    .command('get <daemonId> <uuid>')
    .description('Get real-time details of an instance')
    .action(async (daemonId: string, uuid: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.get('/api/instance', { daemonId, uuid });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  instanceCmd
    .command('create <daemonId> [configJson]')
    .description('Create a new instance on a daemon node')
    .option('-f, --file <filePath>', 'Path to JSON configuration file')
    .option('--name <nickname>', 'Instance nickname')
    .option('--cmd <startCommand>', 'Command to start the process')
    .option('--cwd <cwd>', 'Working directory relative to daemon root')
    .action(async (daemonId: string, configJson: string | undefined, opts: InstanceCreateOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        let config: any = {};
        if (opts.file) {
          config = JSON.parse(fs.readFileSync(opts.file, 'utf-8'));
        } else if (configJson) {
          config = JSON.parse(configJson);
        }
        if (opts.name) config.nickname = opts.name;
        if (opts.cmd) config.startCommand = opts.cmd;
        if (opts.cwd) config.cwd = opts.cwd;

        if (!config.nickname || !config.startCommand || !config.cwd) {
          throw new Error('Instance creation requires "nickname", "startCommand", and "cwd" in config or flags');
        }

        // Validate cwd traversal
        validateSafePath(config.cwd);

        const data = await mcsm.post('/api/instance', config, { daemonId });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  instanceCmd
    .command('update <daemonId> <uuid> [configJson]')
    .description('Update configuration of an existing instance')
    .option('-f, --file <filePath>', 'Path to JSON configuration file')
    .action(async (daemonId: string, uuid: string, configJson: string | undefined, opts: InstanceUpdateOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        let config: any = {};
        if (opts.file) {
          config = JSON.parse(fs.readFileSync(opts.file, 'utf-8'));
        } else if (configJson) {
          config = JSON.parse(configJson);
        } else {
          throw new Error('Configuration JSON string or --file is required');
        }

        try {
          // Admin update
          const data = await mcsm.put('/api/instance', config, { daemonId, uuid });
          printOutput(data, isJson);
        } catch (err: any) {
          // If 403, fallback to user update
          if (err.message && (err.message.includes('403') || err.message.includes('Forbidden'))) {
            const fallbackData = await mcsm.put('/api/protected_instance/instance_update', config, {
              daemonId,
              uuid,
            });
            printOutput(fallbackData, isJson);
          } else {
            throw err;
          }
        }
      } catch (err) {
        printError(err, isJson);
      }
    });

}

export function registerDeletionCommands(instanceCmd: Command, context: CLIContext): void {
  const { getClient } = context;
  instanceCmd
    .command('rm <daemonId> <uuid>')
    .description('Delete an instance')
    .option('--delete-file', 'Permanently remove files on disk', false)
    .action(async (daemonId: string, uuid: string, opts: InstanceDeleteOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.delete(
          '/api/instance',
          { uuids: [uuid], deleteFile: opts.deleteFile },
          { daemonId }
        );
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });
}
