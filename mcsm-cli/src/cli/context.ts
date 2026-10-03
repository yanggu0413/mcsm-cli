import type { Command } from 'commander';
import { MCSMClient, type MCSMClientConfig } from '../client/mcsmClient.js';
import { resolveClientConfig } from '../config.js';
import { printError } from '../output.js';
import { readStdin } from '../utils/stdin.js';

export interface GlobalOptions {
  url?: string;
  key?: string;
  json?: boolean;
}

export interface CLIDependencies {
  createClient?: (config: MCSMClientConfig) => MCSMClient;
  readStdin?: () => Promise<string>;
}

/** Marks an error that has already been written to stderr. */
export class CLIHandledError extends Error {}

export interface CLIContext {
  getClient(options?: GlobalOptions): { mcsm: MCSMClient; isJson: boolean };
  readStdin(): Promise<string>;
  isJsonRequested(): boolean;
  setArgs(args: readonly string[]): void;
}

export function createContext(program: Command, dependencies: CLIDependencies = {}): CLIContext {
  let jsonRequested = false;
  return {
    setArgs(args) {
      jsonRequested = args.includes('-j') || args.includes('--json');
    },
    isJsonRequested() {
      return Boolean(program.opts<GlobalOptions>().json || jsonRequested);
    },
    readStdin: dependencies.readStdin ?? readStdin,
    getClient(options = {}) {
      const globalOptions = program.opts<GlobalOptions>();
      const isJson = Boolean(options.json ?? globalOptions.json);
      const resolved = resolveClientConfig({
        url: options.url || globalOptions.url,
        key: options.key || globalOptions.key,
      });
      if (!resolved.apiKey) {
        const message = 'Missing API Key! Please set it via "mcsm config set --key <your-key>" or MCSM_API_KEY environment variable.';
        printError(new Error(message), isJson);
        throw new CLIHandledError(message);
      }
      const createClient = dependencies.createClient ?? ((config) => new MCSMClient(config));
      return { mcsm: createClient(resolved), isJson };
    },
  };
}
