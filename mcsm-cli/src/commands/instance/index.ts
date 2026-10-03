import type { Command } from 'commander';
import type { CLIContext } from '../../cli/context.js';
import { registerConfigurationCommands, registerDeletionCommands } from './configuration.js';
import { registerLifecycleCommands } from './lifecycle.js';

export function registerInstanceCommands(program: Command, context: CLIContext): void {
  const command = program.command('instance').description('Control and manage instances');
  registerConfigurationCommands(command, context);
  registerLifecycleCommands(command, context);
  registerDeletionCommands(command, context);
}
