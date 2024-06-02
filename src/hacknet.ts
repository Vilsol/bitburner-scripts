import { NodeStats, NS } from '@ns';

const MoneyGainPerLevel = 1.5;
const HacknetNodeMoney = 1;

enum Action {
  BUY_LEVEL = 'Buy Level',
  BUY_RAM = 'Buy RAM',
  BUY_CORE = 'Buy Core',
  BUY_NODE = 'Buy Node',
}

interface Step {
  action: Action;
  gain: number;
  server: number;
  cost: number;
}

const MAX_MONEY_PERCENT_USE = 0.25;

export async function main(ns: NS) {
  ns.tail();

  while (ns.hacknet.numNodes() === 0) {
    ns.hacknet.purchaseNode();
    await ns.asleep(1000);
  }

  while (true) {
    await ns.sleep(1000);

    const steps: Step[] = [];

    for (let i = 0; i < ns.hacknet.numNodes(); i++) {
      let stats = ns.hacknet.getNodeStats(i);
      const currentGain = calculateMoneyGainRate(ns, stats);

      // Level
      stats = ns.hacknet.getNodeStats(i);
      stats.level += 1;
      steps.push({
        action: Action.BUY_LEVEL,
        gain: (calculateMoneyGainRate(ns, stats) - currentGain) / ns.hacknet.getLevelUpgradeCost(i),
        server: i,
        cost: ns.hacknet.getLevelUpgradeCost(i),
      });

      // Memory
      stats = ns.hacknet.getNodeStats(i);
      stats.ram *= 2;
      steps.push({
        action: Action.BUY_RAM,
        gain: (calculateMoneyGainRate(ns, stats) - currentGain) / ns.hacknet.getRamUpgradeCost(i),
        server: i,
        cost: ns.hacknet.getRamUpgradeCost(i),
      });

      // Cores
      stats = ns.hacknet.getNodeStats(i);
      stats.cores += 1;
      steps.push({
        action: Action.BUY_CORE,
        gain: (calculateMoneyGainRate(ns, stats) - currentGain) / ns.hacknet.getCoreUpgradeCost(i),
        server: i,
        cost: ns.hacknet.getCoreUpgradeCost(i),
      });
    }

    if (ns.hacknet.maxNumNodes() > ns.hacknet.numNodes()) {
      const baseStats = ns.hacknet.getNodeStats(0);
      baseStats.cores = 1;
      baseStats.level = 1;
      baseStats.ram = 1;
      const baseGain = calculateMoneyGainRate(ns, baseStats);

      steps.push({
        action: Action.BUY_NODE,
        gain: baseGain / ns.hacknet.getPurchaseNodeCost(),
        cost: ns.hacknet.getPurchaseNodeCost(),
        server: -1,
      });
    }

    steps.sort((a, b) => b.gain - a.gain);

    // Pick one of top 3
    let done = false;
    for (let i = 0; i < 3; i++) {
      ns.printf(
        '%d: hacknet-node-%d %9s %s/$ - $%8s (%s)',
        i + 1,
        steps[i].server,
        steps[i].action,
        ns.formatNumber(steps[i].gain, 10),
        ns.formatNumber(steps[i].cost),
        ns.formatNumber((1 / MAX_MONEY_PERCENT_USE) * steps[i].cost - ns.getPlayer().money),
      );

      if (done) {
        continue;
      }

      if (steps[i].cost > ns.getPlayer().money * MAX_MONEY_PERCENT_USE) {
        continue;
      }

      switch (steps[i].action) {
        case Action.BUY_CORE:
          ns.hacknet.upgradeCore(steps[i].server);
          done = true;
          break;
        case Action.BUY_RAM:
          ns.hacknet.upgradeRam(steps[i].server);
          done = true;
          break;
        case Action.BUY_LEVEL:
          ns.hacknet.upgradeLevel(steps[i].server);
          done = true;
          break;
        case Action.BUY_NODE:
          ns.hacknet.purchaseNode();
          done = true;
          break;
      }
    }
  }
}

const calculateMoneyGainRate = (ns: NS, stats: NodeStats) => {
  const mult = ns.getPlayer().mults.hacknet_node_money;
  const levelMult = stats.level * MoneyGainPerLevel;
  const ramMult = Math.pow(1.035, stats.ram - 1);
  const coresMult = (stats.cores + 5) / 6;
  return levelMult * ramMult * coresMult * mult * HacknetNodeMoney;
};
