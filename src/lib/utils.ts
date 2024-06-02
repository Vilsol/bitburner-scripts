import { NS, Server } from '@ns';

export const HACK_SECURITY_AMOUNT = 0.002;
export const GROW_SECURITY_AMOUNT = 0.004;
export const WEAKEN_SECURITY_AMOUNT = 0.05;

export enum Script {
  WEAKEN = 'weaken.js',
  GROW = 'grow.js',
  HACK = 'hack.js',
  SHARE = 'share.js',
}

export interface Context {
  ns: NS;
  logToTerminal: boolean;
}

/**
 * Test whether target node can be hacked
 */
export const canHack = (ns: NS, server: Server): boolean => {
  const player = ns.getPlayer();

  if ((server.requiredHackingSkill || 0) > player.skills.hacking) {
    // log(ns,
    //   'WARN [%s] Skipping: Hacking skill too low: %d < %d',
    //   server.hostname,
    //   player.skills.hacking,
    //   server.requiredHackingSkill,
    // );
    return false;
  }

  if (!ns.hasRootAccess(server.hostname)) {
    const requiredPorts = ns.getServerNumPortsRequired(server.hostname);

    if (requiredPorts > hackablePortCount(ns)) {
      // log(ns, 'WARN [%s] Skipping: Too many ports: %d', server.hostname, requiredPorts);
      return false;
    }
  }

  return true;
};

/**
 * Calculate how many ports can be hacked
 */
export const hackablePortCount = (ns: NS): number => {
  let count = 0;

  if (ns.fileExists('BruteSSH.exe')) {
    count += 1;
  }

  if (ns.fileExists('FTPCrack.exe')) {
    count += 1;
  }

  if (ns.fileExists('relaySMTP.exe')) {
    count += 1;
  }

  if (ns.fileExists('HTTPWorm.exe')) {
    count += 1;
  }

  if (ns.fileExists('SQLInject.exe')) {
    count += 1;
  }

  return count;
};

/**
 * Root a server
 */
export const rootServer = (ns: NS, target: Server) => {
  if (ns.fileExists('BruteSSH.exe')) {
    ns.brutessh(target.hostname);
  }

  if (ns.fileExists('FTPCrack.exe')) {
    ns.ftpcrack(target.hostname);
  }

  if (ns.fileExists('relaySMTP.exe')) {
    ns.relaysmtp(target.hostname);
  }

  if (ns.fileExists('HTTPWorm.exe')) {
    ns.httpworm(target.hostname);
  }

  if (ns.fileExists('SQLInject.exe')) {
    ns.sqlinject(target.hostname);
  }

  ns.nuke(target.hostname);
};

/**
 * Dispatch a script on the given node
 */
export const dispatch = (ctx: Context, node: Server, target: Server, script: Script, threads: number, delay = 0) => {
  ctx.ns.scp(script, node.hostname, 'home');
  log(
    ctx,
    'INFO [%s] Executing: %s with %d threads with %s delay',
    node.hostname,
    script,
    threads,
    ctx.ns.tFormat(delay),
  );

  const pid = ctx.ns.exec(script, node.hostname, { threads }, target.hostname, threads, delay);
  if (pid === 0) {
    log(ctx, 'ERROR [%s] FAILED EXECUTION!', node.hostname);
  }

  return pid;
};

/**
 * Calculate how many threads can a server run for a given script
 */
export const calculateThreads = (ns: NS, script: Script, host: Server): number => {
  const ram = ns.getScriptRam(script);
  return Math.floor((host.maxRam - host.ramUsed) / ram) - 1;
};

/**
 * Discover all available owned servers
 */
export const discoverNodes = (ns: NS, home = false): Array<Server> => {
  const servers = ns
    .scan()
    .filter((host) => host.startsWith('node'))
    .map(ns.getServer);

  if (home) {
    servers.push(ns.getServer('home'));
  }

  return servers;
};

/**
 * Get date with delay
 */
export const getDate = (delay: number): Date => {
  return new Date(Date.now() + delay);
};

/**
 * Clone the server
 */
export const clone = (ns: NS, server: Server): Server => {
  const mock = ns.formulas.mockServer();
  Object.entries(server).forEach(([k, v]) => ((mock as any)[k] = v));
  return mock;
};

/**
 * Format date
 */
export const dFormat = (ns: NS, date: Date): string => {
  return ns.sprintf('%02d:%02d:%02d.%d', date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
};

export const log = (ctx: Context, format: string, ...values: any[]) => {
  if (ctx.logToTerminal) {
    ctx.ns.tprintf(format, ...values);
  } else {
    ctx.ns.printf(format, ...values);
  }
};
