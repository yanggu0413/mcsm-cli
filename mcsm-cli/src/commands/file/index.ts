import type { Command } from 'commander';
import type { CLIContext } from '../../cli/context.js';
import { registerReadCommands } from './read.js';
import { registerWriteCommands, registerMutationCommands } from './write.js';
import { registerTransferCommands, registerDownloadCommands } from './transfer.js';
import { registerArchiveCommands } from './archive.js';

export function registerFileCommands(program: Command, context: CLIContext): void {
  const command = program.command('file').description('Manage files inside instance directories');
  registerReadCommands(command, context);
  registerWriteCommands(command, context);
  registerTransferCommands(command, context);
  registerMutationCommands(command, context);
  registerDownloadCommands(command, context);
  registerArchiveCommands(command, context);
}
