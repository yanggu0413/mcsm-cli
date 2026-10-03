import type { Command } from 'commander';
import type { CLIContext } from '../cli/context.js';
import { printOutput, printError } from '../output.js';

interface ModSearchOptions { source: string; version?: string; loader?: string; environment: string; }

export function registerModCommands(program: Command, context: CLIContext): void {
  const { getClient } = context;
  const modCmd = program.command('mod').description('Minecraft Mod management');

  modCmd
    .command('search <query>')
    .description('Search mods across Modrinth, CurseForge, and SpigotMC')
    .option('-s, --source <source>', 'Platform source (all, modrinth, curseforge, spigotmc)', 'all')
    .option('-v, --version <version>', 'Minecraft version')
    .option('-l, --loader <loader>', 'Mod loader (fabric, forge, quilt, etc.)')
    .option('-e, --environment <environment>', 'Environment filter: "all", "client", "server"', 'all')
    .action(async (query: string, opts: ModSearchOptions) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.get('/api/mod/search', {
          query,
          source: opts.source,
          version: opts.version,
          loader: opts.loader,
          environment: opts.environment,
        });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  modCmd
    .command('list <daemonId> <uuid>')
    .description('List installed mods in an instance')
    .action(async (daemonId: string, uuid: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.get('/api/mod/list', { daemonId, uuid });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });

  modCmd
    .command('toggle <daemonId> <uuid> <fileName>')
    .description('Toggle mod enabled / disabled status')
    .action(async (daemonId: string, uuid: string, fileName: string) => {
      const { mcsm, isJson } = getClient();
      try {
        const data = await mcsm.post('/api/mod/toggle', { daemonId, uuid, fileName });
        printOutput(data, isJson);
      } catch (err) {
        printError(err, isJson);
      }
    });
}
