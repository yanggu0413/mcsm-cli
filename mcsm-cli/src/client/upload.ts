import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import FormData from 'form-data';

export interface MCSMUploadOptions {
  unzip?: boolean;
  code?: string;
  keepExisting?: boolean;
  daemonAddress?: string;
}

interface UploadTicket {
  password?: string;
  addr?: string;
  remoteMappings?: unknown;
}

type RequestTicket = (params: { daemonId: string; uuid: string; upload_dir: string }) => Promise<UploadTicket>;

/** Upload using a one-time daemon ticket; the panel API key never enters this request. */
export async function uploadFile(
  baseUrl: string,
  requestTicket: RequestTicket,
  daemonId: string,
  uuid: string,
  localPath: string,
  remotePath: string,
  options: MCSMUploadOptions = {},
): Promise<string> {
  const filePath = path.resolve(localPath);
  const fileStat = fs.statSync(filePath);
  if (!fileStat.isFile()) {
    throw new Error(`Upload source is not a file: ${localPath}`);
  }

  const targetPath = remotePath.replace(/\\/g, '/');
  const targetSegments = targetPath.split('/');
  if (targetSegments.includes('..')) {
    throw new Error(`Invalid upload path: "${remotePath}" contains directory traversal`);
  }
  const normalizedTarget = path.posix.normalize(targetPath);
  if (!normalizedTarget.startsWith('/') || normalizedTarget === '/') {
    throw new Error('Upload target must be a file path inside the instance directory');
  }

  const ticket = await requestTicket({
    daemonId,
    uuid,
    upload_dir: path.posix.dirname(normalizedTarget),
  });
  const daemonAddress = options.daemonAddress || ticket?.addr;
  if (!ticket?.password || !daemonAddress) {
    throw new Error('Panel returned an incomplete upload ticket (missing password or daemon address)');
  }

  const panelProtocol = new URL(baseUrl).protocol;
  const daemonBase = daemonAddress.includes('://')
    ? new URL(daemonAddress)
    : new URL(`${panelProtocol}//${daemonAddress}`);
  if (daemonBase.protocol !== 'http:' && daemonBase.protocol !== 'https:') {
    throw new Error(`Unsupported daemon protocol for upload: ${daemonBase.protocol}`);
  }
  if (daemonBase.username || daemonBase.password || daemonBase.pathname !== '/') {
    throw new Error('Panel returned an invalid daemon upload address');
  }

  const uploadUrl = new URL(`/upload/${encodeURIComponent(ticket.password)}`, daemonBase);
  if (options.unzip) uploadUrl.searchParams.set('unzip', 'true');
  if (options.code) uploadUrl.searchParams.set('code', options.code);
  if (options.keepExisting) uploadUrl.searchParams.set('overwrite', 'false');

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), {
    filename: path.posix.basename(normalizedTarget),
    knownLength: fileStat.size,
  });

  try {
    const response = await axios.post<string>(uploadUrl.toString(), form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      maxRedirects: 0,
    });
    return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    const statusText = status ? ` (HTTP ${status})` : '';
    throw new Error(`Direct daemon upload failed${statusText}; verify the daemon address is reachable from this machine`);
  }
}
