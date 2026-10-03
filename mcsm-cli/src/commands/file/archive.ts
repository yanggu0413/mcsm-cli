import type { Command } from 'commander';
import type { CLIContext } from '../../cli/context.js';
import { printOutput, printError } from '../../output.js';
import { validateSafePath } from '../../utils/paths.js';

interface FileArchiveOptions { code: string; }

export function registerArchiveCommands(fileCmd: Command, context: CLIContext): void {
  const { getClient } = context;
  fileCmd
    .command('zip <daemonId> <uuid> <sourceZip> <targets...>')
    .description('Compress files into a ZIP archive')
    .option('-c, --code <code>', 'Encoding for zip filenames (utf-8, gbk, big5)', 'utf-8')
    .action(async (daemonId: string, uuid: string, sourceZip: string, targets: string[], opts: FileArchiveOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        const safeSource = validateSafePath(sourceZip, false);
        const safeTargets = targets.map((t) => validateSafePath(t, false));
        const data = await mcsm.post(
          '/api/files/compress',
          { type: 1, code: opts.code || 'utf-8', source: safeSource, targets: safeTargets },
          { daemonId, uuid }
        );
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  fileCmd
    .command('unzip <daemonId> <uuid> <sourceZip> <targetDir>')
    .description('Decompress a ZIP archive into a destination directory')
    .option('-c, --code <code>', 'Encoding for zip archive (utf-8, gbk, big5)', 'utf-8')
    .action(async (daemonId: string, uuid: string, sourceZip: string, targetDir: string, opts: FileArchiveOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        const safeSource = validateSafePath(sourceZip, false);
        const safeTarget = validateSafePath(targetDir, true);
        const data = await mcsm.post(
          '/api/files/compress',
          { type: 2, code: opts.code || 'utf-8', source: safeSource, targets: safeTarget },
          { daemonId, uuid }
        );
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });
}
