/**
 * MCSManager API types and definitions
 */

export interface IMCSMResponse<T = any> {
  status: number;
  data: T;
  time?: number;
}

export interface IPanelOverview {
  version: string;
  specifiedDaemonVersion?: string;
  process: {
    cpu: number;
    memory: number;
    cwd: string;
  };
  record?: {
    logined: number;
    illegalAccess: number;
    banips: number;
    loginFailed: number;
  };
  system: {
    user?: any;
    time?: number;
    totalmem: number;
    freemem: number;
    type: string;
    version?: string;
    node?: string;
    hostname: string;
    loadavg: number[];
    platform: string;
    release: string;
    uptime: number;
    cpu: number;
  };
  chart?: {
    system: Array<{ cpu: number; mem: number }>;
    request: Array<{ value: number; totalInstance: number; runningInstance: number }>;
  };
  remoteCount?: {
    available: number;
    total: number;
  };
  remote?: any[];
}

export interface IDaemonInfo {
  uuid: string;
  ip: string;
  port: number;
  prefix: string;
  available: boolean;
  remarks: string;
  instances?: any[];
  config?: any;
  dockerPlatforms?: string[];
}

export interface IInstanceConfig {
  nickname: string;
  startCommand: string;
  stopCommand: string;
  stopTimeout?: number;
  cwd: string;
  ie?: string;
  oe?: string;
  createDatetime?: number;
  lastDatetime?: number;
  type?: string;
  tag?: string[];
  endTime?: number;
  fileCode?: string;
  processType?: 'general' | 'docker';
  updateCommand?: string;
  runAs?: string;
  actionCommandList?: any[];
  crlf?: number;
  category?: number;
  basePort?: number;
  enableRcon?: boolean;
  rconPassword?: string;
  rconPort?: number;
  rconIp?: string;
  java?: {
    id: string;
  };
  terminalOption?: {
    haveColor?: boolean;
    pty?: boolean;
    ptyWindowCol?: number;
    ptyWindowRow?: number;
  };
  eventTask?: {
    autoStart?: boolean;
    autoRestart?: boolean;
    autoRestartMaxTimes?: number;
    ignore?: boolean;
  };
  docker?: Record<string, any>;
  pingConfig?: {
    ip?: string;
    port?: number;
    type?: number;
  };
  extraServiceConfig?: {
    openFrpTunnelId?: string;
    openFrpToken?: string;
  };
}

export interface IInstanceDetail {
  instanceUuid: string;
  started?: number;
  autoRestarted?: number;
  status: number; // -1: busy, 0: stopped, 1: stopping, 2: starting, 3: running
  config: IInstanceConfig;
  info?: {
    mcPingOnline?: boolean;
    currentPlayers?: number;
    fileLock?: number;
    maxPlayers?: number;
    openFrpStatus?: boolean;
    playersChart?: Array<{ value: string }>;
    version?: string;
    latency?: number;
    allocatedPorts?: Array<{ host: string; container: number; protocol: string }>;
  };
  space?: number;
  processInfo?: {
    cpu: number;
    memory: number;
    ppid: number;
    pid: number;
    ctime: number;
    elapsed: number;
    timestamp: number;
  };
}

export interface IFileListResult {
  items: Array<{
    name: string;
    size: number;
    time: string;
    mode: number;
    type: number; // 0: folder, 1: file
  }>;
  page: number;
  pageSize: number;
  total: number;
  absolutePath: string;
}

export interface IUserInfo {
  uuid: string;
  userName: string;
  passWord?: string;
  passWordType?: number;
  salt?: string;
  permission: number; // -1: banned, 0: guest, 1: user, 10: admin
  registerTime?: string;
  loginTime?: string;
  instances?: Array<{ instanceUuid: string; daemonId: string }>;
  apiKey?: string;
  isInit?: boolean;
  secret?: string;
  open2FA?: boolean;
  ssoSub?: string;
  ssoBound?: boolean;
}
