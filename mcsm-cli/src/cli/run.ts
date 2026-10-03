import { CommanderError } from 'commander';
import { CLIHandledError, type CLIDependencies } from './context.js';
import { createProgram } from './program.js';
import { printError } from '../output.js';

export async function runCli(argv: string[] = process.argv, dependencies: CLIDependencies = {}): Promise<void> {
  const program = createProgram(dependencies);
  try {
    await program.parseAsync(argv);
  } catch (error) {
    if (error instanceof CLIHandledError) return;
    if (error instanceof CommanderError) {
      process.exitCode = error.exitCode;
      return;
    }
    printError(error, argv.includes('-j') || argv.includes('--json'));
  }
}
