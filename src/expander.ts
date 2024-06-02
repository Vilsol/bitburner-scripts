import { NS } from '@ns';
import { hackablePortCount, rootServer } from './lib/utils';

/** @param {NS} ns */
export async function main(ns: NS) {
  const player = ns.getPlayer();

  const found = new Set();
  const queue = ['home'];

  const runners = [];

  let maxMoney = 0;
  let maxMoneyTarget = '';

  while (queue.length > 0) {
    const target = queue.pop();
    if (!target) {
      continue;
    }

    found.add(target);

    ns.tprintf('INFO [%s] Scanning', target);

    const neighbor = ns.scan(target);
    ns.tprintf('INFO [%s] Found: %d neighbors %s', target, neighbor.length, JSON.stringify(neighbor));

    for (let i = 0; i < neighbor.length; i++) {
      if (!found.has(neighbor[i])) {
        queue.push(neighbor[i]);
      }
    }

    // Ignore home
    if (target === 'home') {
      ns.tprintf('WARN [%s] Skipping: Home', target);
      continue;
    }

    const server = ns.getServer(target);

    if ((server.requiredHackingSkill || 0) > player.skills.hacking) {
      ns.tprintf(
        'WARN [%s] Skipping: Hacking skill too low: %d < %d',
        target,
        player.skills.hacking,
        server.requiredHackingSkill,
      );
      continue;
    }

    const memoryForBasic = ns.getScriptRam('basic.js');
    const threads = Math.floor(server.maxRam / memoryForBasic);

    if (threads < 1) {
      ns.tprintf('WARN [%s] Skipping: Not enough memory: %d', target, server.maxRam);
      continue;
    }

    if (!ns.hasRootAccess(target)) {
      const requiredPorts = ns.getServerNumPortsRequired(target);
      ns.tprintf('INFO [%s] Requires: %d ports', target, requiredPorts);

      if (requiredPorts > hackablePortCount(ns)) {
        ns.tprintf('WARN [%s] Skipping: Too many ports: %d', target, requiredPorts);
        continue;
      }
    }

    const targetMaxMoney = ns.getServerMaxMoney(target);
    if (targetMaxMoney < 10_000 || !targetMaxMoney) {
      ns.tprintf('WARN [%s] Skipping: Not enough money: %s', target, new Intl.NumberFormat().format(targetMaxMoney));
      runners.push(target);
      continue;
    }

    ns.tprintf('INFO [%s] Max Money: %s', target, new Intl.NumberFormat().format(targetMaxMoney));

    if ((server.moneyMax || 0) > maxMoney) {
      maxMoney = server.moneyMax || 0;
      maxMoneyTarget = target;
    }

    const money = ns.getServerMoneyAvailable(target);
    const minSec = ns.getServerMinSecurityLevel(target);
    const sec = ns.getServerSecurityLevel(target);
    ns.tprint(`

${target}:
    $          : ${ns.nFormat(money, '$0.000a')} / ${ns.nFormat(targetMaxMoney, '$0.000a')} (${(
      (money / targetMaxMoney) *
      100
    ).toFixed(2)}%)
    security   : ${minSec.toFixed(2)} / ${sec.toFixed(2)}
    growth     : ${ns.getServerGrowth(target)}
    hack time  : ${ns.tFormat(ns.getHackTime(target))}
    grow time  : ${ns.tFormat(ns.getGrowTime(target))}
    weaken time: ${ns.tFormat(ns.getWeakenTime(target))}
    hackChance : ${(ns.hackAnalyzeChance(target) * 100).toFixed(2)}%
`);

    runScript(ns, target, target);
  }

  // Temporary hardcode
  maxMoneyTarget = 'silver-helix';
  maxMoney = ns.getServerMaxMoney(maxMoneyTarget);

  ns.tprintf('INFO [%s] Money target: %d', maxMoneyTarget, maxMoney);

  while (runners.length > 0) {
    const runner = runners.pop();
    if (!runner) {
      continue;
    }

    runScript(ns, runner, maxMoneyTarget);
  }
}

/**
 * @param {NS} ns
 * @param {string} runner
 * @param {string} target
 */
const runScript = (ns: NS, runner: string, target: string) => {
  const runnerServer = ns.getServer(runner);
  const memoryForBasic = ns.getScriptRam('basic.js');
  const threads = Math.floor(runnerServer.maxRam / memoryForBasic);

  rootServer(ns, runnerServer);
  rootServer(ns, ns.getServer(target));

  ns.killall(runner, true);

  // TODO Decide what to run
  ns.scp('basic.js', runner, 'home');

  const server = ns.getServer(target);

  ns.tprintf('SUCCESS [%s] Runnning script: Targeting %s with %d threads', runner, target, threads);
  ns.exec(
    'basic.js',
    runner,
    threads,
    target,
    (server.moneyMax || 0) * 0.9,
    (server.minDifficulty || 0) * 1.5,
    threads,
  );
};
