import type { Command } from 'commander';
import type { CLIContext } from '../../cli/context.js';
import { printOutput, printError } from '../../output.js';
import { validateSafePath, isBinaryPath } from '../../utils/paths.js';
import { clampPageSize } from '../../utils/pagination.js';

interface FileListOptions { page: string; pageSize: string; }
interface FileReadOptions { force: boolean; maxSize: string; }

export function registerReadCommands(fileCmd: Command, context: CLIContext): void {
  const { getClient } = context;
  fileCmd
    .command('ls <daemonId> <uuid> [target]')
    .description('List files and folders in an instance directory')
    .option('-p, --page <page>', 'Page number (starts from 0)', '0')
    .option('-s, --page-size <pageSize>', 'Page size (1-100)', '50')
    .action(async (daemonId: string, uuid: string, target: string = '/', opts: FileListOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        const safeTarget = validateSafePath(target, true);
        const data = await mcsm.get('/api/files/list', {
          daemonId,
          uuid,
          target: safeTarget,
          page: Number(opts.page) || 0,
          page_size: clampPageSize(opts.pageSize, 50, 100),
          file_name: '',
        });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  fileCmd
    .command('status <daemonId> <uuid>')
    .description('Get file system status, active downloads, and background file tasks')
    .action(async (daemonId: string, uuid: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.get('/api/files/status', { daemonId, uuid });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  fileCmd
    .command('cat <daemonId> <uuid> <target>')
    .description('Read text content of a file')
    .option('--force', 'Force read even if target is identified as binary file', false)
    .option('--max-size <maxSize>', 'Max bytes to read (default: 1048576 = 1MB)', '1048576')
    .action(async (daemonId: string, uuid: string, target: string, opts: FileReadOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        const safeTarget = validateSafePath(target, false);
        if (isBinaryPath(safeTarget) && !opts.force) {
          throw new Error(
            `Target file "${safeTarget}" appears to be a binary file. Reading directly may cause OOM. Use download or pass --force.`
          );
        }
        const data = await mcsm.put('/api/files/', { target: safeTarget }, { daemonId, uuid });
        if (typeof data === 'string' && data.length > Number(opts.maxSize)) {
          const truncated = data.slice(0, Number(opts.maxSize)) + '\n... [TRUNCATED DUE TO SIZE LIMIT]';
          printOutput(truncated, isJson);
          return;
        }
        if (!isJson && typeof data === 'string') {
          process.stdout.write(data);
          if (!data.endsWith('\n')) process.stdout.write('\n');
        } else {
          printOutput(data, isJson);
        }
      } catch (err) {
        printError(err, isJson);
      }
    });
}
