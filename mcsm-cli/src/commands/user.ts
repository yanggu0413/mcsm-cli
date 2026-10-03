import type { Command } from 'commander';
import type { CLIContext } from '../cli/context.js';
import { printOutput, printError } from '../output.js';
import { clampPageSize } from '../utils/pagination.js';
import { desensitizeUserInfo } from '../utils/redaction.js';

interface UserListOptions { page: string; pageSize: string; name?: string; }
interface UserMeOptions { advanced: boolean; }

export function registerUserCommands(program: Command, context: CLIContext): void {
  const { getClient } = context;
  const userCmd = program.command('user').description('User and permission management');

  userCmd
    .command('list')
    .description('List registered users (Admin only)')
    .option('-p, --page <page>', 'Page number', '1')
    .option('-s, --page-size <pageSize>', 'Page size (1-50)', '20')
    .option('-n, --name <name>', 'Fuzzy username search')
    .action(async (opts: UserListOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.get('/api/auth/search', {
          page: Number(opts.page) || 1,
          page_size: clampPageSize(opts.pageSize, 20, 50),
          userName: opts.name,
        });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  userCmd
    .command('me')
    .description('Get current authenticated user info and allocated instances')
    .option('--advanced', 'Resolve detailed instance statuses', false)
    .action(async (opts: UserMeOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        const rawData = await mcsm.get('/api/auth', { advanced: opts.advanced });
        const data = desensitizeUserInfo(rawData);
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });
}
