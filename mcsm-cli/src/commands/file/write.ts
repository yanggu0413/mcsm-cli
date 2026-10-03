import type { Command } from 'commander';
import type { CLIContext } from '../../cli/context.js';
import { printOutput, printError } from '../../output.js';
import fs from 'fs';
import { validateSafePath } from '../../utils/paths.js';

interface FileWriteOptions { file?: string; }

export function registerWriteCommands(fileCmd: Command, context: CLIContext): void {
  const { getClient, readStdin } = context;
  fileCmd
    .command('write <daemonId> <uuid> <target> [text]')
    .description('Write text content into a file (supports stdin or --file)')
    .option('-f, --file <localFilePath>', 'Path to local file to upload')
    .action(async (daemonId: string, uuid: string, target: string, text: string | undefined, opts: FileWriteOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        const safeTarget = validateSafePath(target, false);
        let contentToWrite: string;

        if (opts.file) {
          contentToWrite = fs.readFileSync(opts.file, 'utf-8');
        } else if (text !== undefined && text !== '-') {
          contentToWrite = text;
        } else {
          // Read from stdin
          contentToWrite = await readStdin();
        }

        const data = await mcsm.put(
          '/api/files/',
          { target: safeTarget, text: contentToWrite },
          { daemonId, uuid }
        );
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

}

export function registerMutationCommands(fileCmd: Command, context: CLIContext): void {
  const { getClient } = context;
  fileCmd
    .command('rm <daemonId> <uuid> <targets...>')
    .description('Delete files or directories')
    .action(async (daemonId: string, uuid: string, targets: string[]) => {
      const { mcsm, isJson } = getClient();
      try {
        const safeTargets = targets.map((t) => validateSafePath(t, false));
        const data = await mcsm.delete('/api/files', { targets: safeTargets }, { daemonId, uuid });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  fileCmd
    .command('mkdir <daemonId> <uuid> <target>')
    .description('Create a new directory')
    .action(async (daemonId: string, uuid: string, target: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const safeTarget = validateSafePath(target, false);
        const data = await mcsm.post('/api/files/mkdir', { target: safeTarget }, { daemonId, uuid });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

}
