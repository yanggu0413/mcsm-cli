export function printOutput(data: any, isJson: boolean): void {
  if (isJson) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (typeof data === 'string') {
    console.log(data);
  } else if (typeof data === 'boolean' || typeof data === 'number') {
    console.log(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

export function printError(err: any, isJson: boolean): void {
  const message = err instanceof Error ? err.message : String(err);
  if (isJson) {
    console.error(JSON.stringify({ status: 'error', message }, null, 2));
  } else {
    console.error(`[Error] ${message}`);
  }
  process.exitCode = 1;
}
