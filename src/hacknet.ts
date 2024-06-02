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
      steps.push(
        ...getSteps(
          ns,
          ns.hacknet.getLevelUpgradeCost(i),
          ns.hacknet.getRamUpgradeCost(i),
          ns.hacknet.getCoreUpgradeCost(i),
          ns.hacknet.getNodeStats(i),
          i,
        ),
      );
    }

    // Node buying
    if (ns.hacknet.maxNumNodes() > ns.hacknet.numNodes()) {
      if (ns.fileExists('Formulas.exe')) {
        const [baseStats, cost] = simulateBuyNode(ns);
        const baseGain = calculateMoneyGainRate(ns, baseStats);

        steps.push({
          action: Action.BUY_NODE,
          gain: baseGain / cost,
          cost: cost,
          server: -1,
        });
      } else {
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
    }

    steps.sort((a, b) => b.gain - a.gain);

    // Pick one of top 3
    let done = false;
    for (let i = 0; i < 3; i++) {
      ns.printf(
        '%d: [%d] %9s %s/$ - $%8s (%s)',
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

const simulateBuyNode = (ns: NS): [NodeStats, number] => {
  let availableMoney = ns.getPlayer().money * MAX_MONEY_PERCENT_USE;
  availableMoney -= ns.hacknet.getPurchaseNodeCost();

  const stats = ns.hacknet.getNodeStats(0);
  stats.level = 1;
  stats.cores = 1;
  stats.ram = 1;

  while (availableMoney > 0) {
    const levelCost = ns.formulas.hacknetNodes.levelUpgradeCost(
      stats.level,
      1,
      ns.getPlayer().mults.hacknet_node_level_cost,
    );
    const ramCost = ns.formulas.hacknetNodes.ramUpgradeCost(stats.ram, 1, ns.getPlayer().mults.hacknet_node_ram_cost);
    const coreCost = ns.formulas.hacknetNodes.coreUpgradeCost(
      stats.cores,
      1,
      ns.getPlayer().mults.hacknet_node_core_cost,
    );

    const steps = getSteps(ns, levelCost, ramCost, coreCost, stats);
    steps.sort((a, b) => b.gain - a.gain);

    const step = steps[0];
    if (step.cost > availableMoney) {
      break;
    }

    availableMoney -= step.cost;

    switch (step.action) {
      case Action.BUY_CORE:
        stats.cores++;
        break;
      case Action.BUY_RAM:
        stats.ram *= 2;
        break;
      case Action.BUY_LEVEL:
        stats.level++;
        break;
    }
  }

  return [stats, ns.getPlayer().money * MAX_MONEY_PERCENT_USE - availableMoney];
};

const getSteps = (ns: NS, levelCost: number, ramCost: number, coreCost: number, stats: NodeStats, i = 0): Step[] => {
  const steps: Step[] = [];
  const currentGain = calculateMoneyGainRate(ns, stats);

  // Level
  stats.level += 1;
  steps.push({
    action: Action.BUY_LEVEL,
    gain: (calculateMoneyGainRate(ns, stats) - currentGain) / levelCost,
    server: i,
    cost: levelCost,
  });
  stats.level -= 1;

  // Memory
  stats.ram *= 2;
  steps.push({
    action: Action.BUY_RAM,
    gain: (calculateMoneyGainRate(ns, stats) - currentGain) / ramCost,
    server: i,
    cost: ramCost,
  });
  stats.ram /= 2;

  // Cores
  stats.cores += 1;
  steps.push({
    action: Action.BUY_CORE,
    gain: (calculateMoneyGainRate(ns, stats) - currentGain) / coreCost,
    server: i,
    cost: coreCost,
  });
  stats.cores -= 1;

  return steps;
};
