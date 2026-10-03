import type { Command } from 'commander';
import type { CLIContext, GlobalOptions } from '../cli/context.js';
import { printOutput, printError } from '../output.js';
import { saveStoredConfig, loadStoredConfig, resolveClientConfig, getStoredConfigPath, maskApiKey } from '../config.js';

export function registerConfigCommands(program: Command, _context: CLIContext): void {
  const configCmd = program.command('config').description('Manage CLI credentials & settings');

  configCmd
    .command('set [url] [key]')
    .description('Save panel URL or API Key permanently')
    .option('-u, --url <url>', 'Panel URL')
    .option('-k, --key <key>', 'API Key')
    .action((posUrl: string | undefined, posKey: string | undefined, opts: GlobalOptions, cmd: Command) => {
      const isJson = Boolean(program.opts<GlobalOptions>().json);
      const allOpts = cmd?.optsWithGlobals ? cmd.optsWithGlobals<GlobalOptions>() : { ...program.opts<GlobalOptions>(), ...opts };
      const targetUrl = (typeof posUrl === 'string' ? posUrl : undefined) || allOpts.url;
      const targetKey = (typeof posKey === 'string' ? posKey : undefined) || allOpts.key;

      if (!targetUrl && !targetKey) {
        printError(new Error('Please provide --url or --key to save.'), isJson);
        return;
      }
      const update: Record<string, string> = {};
      if (targetUrl) update.url = targetUrl;
      if (targetKey) update.apiKey = targetKey;
      saveStoredConfig(update);
      printOutput({ success: true, message: `Configuration saved to ${getStoredConfigPath()}` }, isJson);
    });

  configCmd
    .command('get')
    .description('Display current saved config and path')
    .action(() => {
      const isJson = Boolean(program.opts().json);
      const stored = loadStoredConfig();
      const effective = resolveClientConfig(program.opts());
      printOutput(
        {
          configFile: getStoredConfigPath(),
          saved: {
            url: stored.url || null,
            apiKey: maskApiKey(stored.apiKey),
          },
          effective: {
            url: effective.baseUrl,
            apiKey: maskApiKey(effective.apiKey),
          },
        },
        isJson
      );
    });
}
