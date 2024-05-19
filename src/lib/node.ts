import { NS, Server } from '@ns';
import { canHack, discoverNodes } from './utils';

/**
 * Polls all nodes until one is available for scheduling and returns it
 */
export const getNode = async (ns: NS, ram: number): Promise<Server> => {
  return new Promise<Server>((r) => {
    const search = () => {
      for (const node of discoverNodes(ns)) {
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
        ns.tprintf('INFO Searching for available node of %s RAM...', ns.formatRam(ram));
        if (!search()) {
          ns.tprintf('WARN No nodes available');
          searchTimeout();
        }
      }, 1000);
    };

    searchTimeout();
  }).then((node) => {
    ns.tprintf('INFO Picked node: %s', node.hostname);
    return node;
  });
};

export const waitForRAM = (ns: NS, ram: number[]) => {
  return new Promise<void>((r) => {
    const search = () => {
      ns.tprintf('INFO Searching for nodes...');

      const nodes = discoverNodes(ns);
      const remaining = [...ram];

      remaining.sort((a, b) => b - a);

      nodes.forEach((node) => {
        let availableRAM = node.maxRam - node.ramUsed;
        const toRemove: number[] = [];
        for (let i = 0; i < remaining.length; i++) {
          if (remaining[i] < availableRAM) {
            availableRAM -= remaining[i];
            ns.tprintf(
              'INFO Putting %s on %s (remaining %s)',
              ns.formatRam(remaining[i]),
              node.hostname,
              ns.formatRam(availableRAM),
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

      ns.tprintf('WARN Not enough node memory available');

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
export const findTarget = (ns: NS): Server => {
  let maxMoneyServer: Server = ns.getServer();

  for (const server of findAll(ns)) {
    if (!canHack(ns, server.server)) {
      continue;
    }

    if (server.server.moneyMax) {
      ns.tprintf(
        'INFO [%s] Max Money: %s, Min Diff: %s',
        server.server.hostname,
        ns.formatNumber(server.server.moneyMax || 0),
        ns.formatNumber(server.server.minDifficulty || 0),
      );
    }

    if ((server.server.moneyMax || 0) > (maxMoneyServer.moneyMax || 0)) {
      maxMoneyServer = server.server;
    }
  }

  // TODO Temporary override
  maxMoneyServer = ns.getServer('lexo-corp');

  ns.tprintf(
    'SUCCESS [%s] Chosen Target Money: %s',
    maxMoneyServer.hostname,
    ns.formatNumber(maxMoneyServer.moneyMax || 0),
  );

  const money = ns.getServerMoneyAvailable(maxMoneyServer.hostname);
  const minSec = ns.getServerMinSecurityLevel(maxMoneyServer.hostname);
  const sec = ns.getServerSecurityLevel(maxMoneyServer.hostname);

  ns.tprint(`
${maxMoneyServer.hostname}:
    $          : ${ns.formatNumber(money)} / ${ns.formatNumber(maxMoneyServer.moneyMax || 0)} (${(
    (money / (maxMoneyServer.moneyMax || 0)) *
    100
  ).toFixed(2)}%)
    security   : ${minSec.toFixed(2)} / ${sec.toFixed(2)}
    hack time  : ${ns.tFormat(ns.getHackTime(maxMoneyServer.hostname))}
    grow time  : ${ns.tFormat(ns.getGrowTime(maxMoneyServer.hostname))}
    weaken time: ${ns.tFormat(ns.getWeakenTime(maxMoneyServer.hostname))}
    hackChance : ${(ns.hackAnalyzeChance(maxMoneyServer.hostname) * 100).toFixed(2)}%
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
