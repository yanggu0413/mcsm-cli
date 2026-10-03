import type { Command } from 'commander';
import type { CLIContext } from '../cli/context.js';
import { printOutput, printError } from '../output.js';

export function registerJavaCommands(program: Command, context: CLIContext): void {
  const { getClient } = context;
  const javaCmd = program.command('java').description('Manage Java runtime environments on a daemon');

  javaCmd
    .command('list <daemonId> <instanceId>')
    .description('List available Java runtimes')
    .action(async (daemonId: string, instanceId: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.get('/api/java_manager/list', { daemonId, instanceId });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  javaCmd
    .command('add <daemonId> <instanceId> <name> <path>')
    .description('Register a custom local Java executable path (Admin only)')
    .action(async (daemonId: string, instanceId: string, name: string, javaPath: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.post(
          '/api/java_manager/add',
          { name, path: javaPath },
          { daemonId, instanceId }
        );
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  javaCmd
    .command('download <daemonId> <instanceId> <name> <version>')
    .description('Download and install a Java version on the daemon')
    .action(async (daemonId: string, instanceId: string, name: string, version: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.post(
          '/api/java_manager/download',
          { name, version },
          { daemonId, instanceId }
        );
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  javaCmd
    .command('use <daemonId> <instanceId> <runtimeId>')
    .description('Bind a Java runtime to the instance')
    .action(async (daemonId: string, instanceId: string, runtimeId: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.post(
          '/api/java_manager/using',
          { id: runtimeId },
          { daemonId, instanceId }
        );
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  javaCmd
    .command('rm <daemonId> <instanceId> <runtimeId>')
    .description('Delete a Java runtime configuration')
    .action(async (daemonId: string, instanceId: string, runtimeId: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.delete(
          '/api/java_manager/delete',
          { id: runtimeId },
          { daemonId, instanceId }
        );
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });
}
