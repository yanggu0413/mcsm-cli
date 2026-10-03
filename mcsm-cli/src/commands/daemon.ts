import type { Command } from 'commander';
import type { CLIContext } from '../cli/context.js';
import { printOutput, printError } from '../output.js';
import { clampPageSize } from '../utils/pagination.js';

interface DaemonListOptions { mode: string; }
interface DaemonAddOptions { prefix: string; }
interface DaemonSearchOptions { page: string; pageSize: string; }

export function registerDaemonCommands(program: Command, context: CLIContext): void {
  const { getClient } = context;
  const daemonCmd = program.command('daemon').description('Manage remote daemon nodes');

  daemonCmd
    .command('list')
    .description('List all daemon nodes')
    .option(
      '-m, --mode <mode>',
      'List mode: "basic", "with_instances", "with_system_metrics"',
      'with_instances'
    )
    .action(async (opts: DaemonListOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        let endpoint = '/api/service/remote_services';
        if (opts.mode === 'basic') endpoint = '/api/service/remote_services_list';
        if (opts.mode === 'with_system_metrics') endpoint = '/api/service/remote_services_system';
        const data = await mcsm.get(endpoint);
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  daemonCmd
    .command('add <ip> <port> <apiKey> <remarks>')
    .description('Register a new remote daemon node (Admin only)')
    .option('--prefix <prefix>', 'Custom URL prefix if any', '')
    .action(async (ip: string, port: string, apiKey: string, remarks: string, opts: DaemonAddOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.post('/api/service/remote_service', {
          ip,
          port: Number(port),
          apiKey,
          remarks,
          prefix: opts.prefix || '',
        });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  daemonCmd
    .command('rm <uuid>')
    .description('Remove a registered daemon node (Admin only)')
    .action(async (uuid: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.delete('/api/service/remote_service', undefined, { uuid });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  daemonCmd
    .command('link <uuid>')
    .description('Test and reconnect to a daemon node')
    .action(async (uuid: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.get('/api/service/link_remote_service', { uuid });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  daemonCmd
    .command('search <keyword>')
    .description('Search instances globally across all daemon nodes')
    .option('-p, --page <page>', 'Page number', '1')
    .option('-s, --page-size <pageSize>', 'Page size (1-50)', '20')
    .action(async (keyword: string, opts: DaemonSearchOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.get('/api/service/remote_services_instances_global', {
          instance_name: keyword,
          page: Number(opts.page) || 1,
          page_size: clampPageSize(opts.pageSize, 20, 50),
        });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });
}
