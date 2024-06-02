import { NS, Server } from '@ns';
import { canHack, clone, Context, discoverNodes, HACK_SECURITY_AMOUNT, log } from './utils';

/**
 * Polls all nodes until one is available for scheduling and returns it
 */
export const getNode = async (ctx: Context, ram: number, home = false): Promise<Server> => {
  return new Promise<Server>((r) => {
    const search = () => {
      for (const node of discoverNodes(ctx.ns, home)) {
        if (node.hostname === 'home') {
          if (node.ramUsed > node.maxRam * 0.8) {
            continue;
          }
        }

        if (ram === 0 && node.ramUsed === 0) {
          r(node);
          return true;
        }

        if (ram > 0 && node.maxRam - node.ramUsed > ram) {
          r(node);
          return true;
        }
      }
      return false;
    };

    if (search()) {
      return;
    }

    const searchTimeout = () => {
      setTimeout(() => {
        log(ctx, 'INFO Searching for available node of %s RAM...', ctx.ns.formatRam(ram));
        if (!search()) {
          log(ctx, 'WARN No nodes available');
          searchTimeout();
        }
      }, 1000);
    };

    searchTimeout();
  }).then((node) => {
    log(ctx, 'INFO Picked node: %s', node.hostname);
    return node;
  });
};

export const waitForRAM = (ctx: Context, ram: number[], home = false) => {
  return new Promise<void>((r) => {
    const search = () => {
      log(ctx, 'INFO Searching for nodes...');

      const nodes = discoverNodes(ctx.ns, home);
      const remaining = [...ram];

      remaining.sort((a, b) => b - a);

      nodes.forEach((node) => {
        let availableRAM = node.maxRam - node.ramUsed;
        const toRemove: number[] = [];
        for (let i = 0; i < remaining.length; i++) {
          if (remaining[i] < availableRAM) {
            availableRAM -= remaining[i];
            log(
              ctx,
              'INFO Putting %s on %s (remaining %s)',
              ctx.ns.formatRam(remaining[i]),
              node.hostname,
              ctx.ns.formatRam(availableRAM),
            );
            toRemove.push(i);
          }
        }

        toRemove.sort().reverse();
        for (const i of toRemove) {
          remaining.splice(i, 1);
        }
      });

      if (remaining.length === 0) {
        r();
        return true;
      }

      log(ctx, 'WARN Not enough node memory available');

      return false;
    };

    if (search()) {
      return;
    }

    const searchTimeout = () => {
      setTimeout(() => {
        if (!search()) {
          searchTimeout();
        }
      }, 10000);
    };

    searchTimeout();
  });
};

/**
 * Find best value target
 */
export const findTarget = (ctx: Context): Server => {
  let maxMoneyServer: Server = ctx.ns.getServer();
  let maxServerMoneyPerMs = 0;

  for (const server of findAll(ctx.ns)) {
    if (!canHack(ctx.ns, server.server)) {
      continue;
    }

    if (server.server.moneyMax) {
      const hackPercent = ctx.ns.hackAnalyze(server.server.hostname);
      const hackMoney = hackPercent * (server.server.moneyMax || 0);

      const fake = clone(ctx.ns, server.server);
      fake.moneyAvailable = fake.moneyMax;
      fake.hackDifficulty = (fake.minDifficulty || 0) + HACK_SECURITY_AMOUNT;
      const weakenTime = ctx.ns.formulas.hacking.weakenTime(fake, ctx.ns.getPlayer());

      const moneyPerMs = hackMoney / weakenTime;

      log(
        ctx,
        'INFO [%s] Max Money: %s, Min Diff: %s, Money/ms: %s (%s/%d ms)',
        server.server.hostname,
        ctx.ns.formatNumber(server.server.moneyMax || 0),
        ctx.ns.formatNumber(server.server.minDifficulty || 0),
        ctx.ns.formatNumber(moneyPerMs),
        ctx.ns.formatNumber(hackMoney),
        weakenTime,
      );

      if (moneyPerMs > maxServerMoneyPerMs) {
        maxMoneyServer = server.server;
        maxServerMoneyPerMs = moneyPerMs;
      }
    }
  }

  // TODO Temporary override
  // maxMoneyServer = ns.getServer('rothman-uni');

  log(
    ctx,
    'SUCCESS [%s] Chosen Target Money: %s/ms',
    maxMoneyServer.hostname,
    ctx.ns.formatNumber(maxServerMoneyPerMs),
  );

  const money = ctx.ns.getServerMoneyAvailable(maxMoneyServer.hostname);
  const minSec = ctx.ns.getServerMinSecurityLevel(maxMoneyServer.hostname);
  const sec = ctx.ns.getServerSecurityLevel(maxMoneyServer.hostname);

  ctx.ns.tprint(`
${maxMoneyServer.hostname}:
    $          : ${ctx.ns.formatNumber(money)} / ${ctx.ns.formatNumber(maxMoneyServer.moneyMax || 0)} (${(
    (money / (maxMoneyServer.moneyMax || 0)) *
    100
  ).toFixed(2)}%)
    security   : ${minSec.toFixed(2)} / ${sec.toFixed(2)}
    hack time  : ${ctx.ns.tFormat(ctx.ns.getHackTime(maxMoneyServer.hostname))}
    grow time  : ${ctx.ns.tFormat(ctx.ns.getGrowTime(maxMoneyServer.hostname))}
    weaken time: ${ctx.ns.tFormat(ctx.ns.getWeakenTime(maxMoneyServer.hostname))}
    hackChance : ${(ctx.ns.hackAnalyzeChance(maxMoneyServer.hostname) * 100).toFixed(2)}%
`);

  return maxMoneyServer;
};

interface Queued {
  name: string;
  path: string[];
}

interface ServerWithPath {
  server: Server;
  path: string[];
}

export const findAll = (ns: NS): ServerWithPath[] => {
  const found = new Set<string>();
  const queue: Array<Queued> = [
    {
      name: 'home',
      path: [],
    },
  ];
  const servers: ServerWithPath[] = [];

  while (queue.length > 0) {
    const target = queue.pop();
    if (!target) {
      continue;
    }

    found.add(target.name);

    ns.scan(target.name)
      .filter((host) => !found.has(host))
      .forEach((host) =>
        queue.push({
          name: host,
          path: [...target.path, target.name],
        }),
      );

    servers.push({
      server: ns.getServer(target.name),
      path: target.path,
    });
  }

  return servers;
};
