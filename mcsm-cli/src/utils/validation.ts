export function validateNoNewlines(command: string): void {
  if (/[\r\n]/.test(command)) {
    throw new Error('Command contains newline characters (potential command injection vulnerability)');
  }
}

export function checkSafeDownloadUrl(urlStr: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error(`Invalid URL: "${urlStr}"`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported URL protocol: "${parsed.protocol}". Only HTTP and HTTPS are permitted.`);
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname === '169.254.169.254' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.internal') ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    /^192\.168\./.test(hostname)
  ) {
    throw new Error(`SSRF Protection: Access to private/internal network address "${hostname}" is forbidden.`);
  }
}

export function normalizeLogSize(value: string = '20KB'): string {
  const size = value || '20KB';
  const match = size.match(/^(\d+)(kb|b|mb)?$/i);
  if (!match) return size;
  const number = Number(match[1]);
  const unit = (match[2] || 'kb').toLowerCase();
  const bytes = number * (unit === 'mb' ? 1024 * 1024 : unit === 'kb' ? 1024 : 1);
  return bytes > 100 * 1024 ? '100KB' : size;
}

export function parseScheduleCount(value: string = '-1'): number {
  const count = Number(value);
  if (!value.trim() || !Number.isSafeInteger(count) || count < -1) {
    throw new Error('Schedule count must be -1 or a non-negative safe integer');
  }
  return count;
}
