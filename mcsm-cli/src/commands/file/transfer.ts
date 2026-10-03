import type { Command } from 'commander';
import type { CLIContext } from '../../cli/context.js';
import { printOutput, printError } from '../../output.js';
import { validateSafePath } from '../../utils/paths.js';
import { checkSafeDownloadUrl } from '../../utils/validation.js';

interface FileUploadOptions { unzip: boolean; code: string; keepExisting: boolean; daemonAddr?: string; }

export function registerTransferCommands(fileCmd: Command, context: CLIContext): void {
  const { getClient } = context;
  fileCmd
    .command('upload <daemonId> <uuid> <localPath> <target>')
    .description('Upload a local binary or text file directly to an instance')
    .option('--unzip', 'Extract the uploaded archive after transfer', false)
    .option('-c, --code <code>', 'Filename encoding when extracting an archive', 'utf-8')
    .option('--keep-existing', 'Keep an existing remote file and auto-rename the uploaded file', false)
    .option('--daemon-addr <address>', 'Override the upload daemon address (host:port or http(s) URL)')
    .action(async (daemonId: string, uuid: string, localPath: string, target: string, opts: FileUploadOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        const safeTarget = validateSafePath(target, false);
        const result = await mcsm.uploadFile(daemonId, uuid, localPath, safeTarget, {
          unzip: opts.unzip,
          code: opts.unzip ? opts.code : undefined,
          keepExisting: opts.keepExisting,
          daemonAddress: opts.daemonAddr,
        });
        printOutput({ success: true, target: safeTarget, result }, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

}

export function registerDownloadCommands(fileCmd: Command, context: CLIContext): void {
  const { getClient } = context;
  fileCmd
    .command('download <daemonId> <uuid> <url> <fileName>')
    .description('Download a file from Web URL to the instance directory')
    .action(async (daemonId: string, uuid: string, url: string, fileName: string) => {
      const { mcsm, isJson } = getClient();
      try {
        checkSafeDownloadUrl(url);
        const safeFileName = validateSafePath(fileName, false);
        const data = await mcsm.post(
          '/api/files/download_from_url',
          { url, file_name: safeFileName },
          { daemonId, uuid }
        );
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });
}
