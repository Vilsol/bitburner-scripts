import { NS } from '@ns';

export async function main(ns: NS) {
  const nodes = ns.getPurchasedServers();
  const node = ns.getServer(nodes[0]);
  const targetRAM = node.maxRam * 2;
  const cost = ns.getPurchasedServerUpgradeCost(node.hostname, targetRAM);
  const totalCost = nodes.length * cost;

  ns.tprintf('Cost: %s x %d = %s', ns.formatNumber(cost), nodes.length, ns.formatNumber(totalCost));

  if (ns.getPlayer().money < totalCost) {
    ns.tprintf('ERROR Not enough money: %s < %s', ns.formatNumber(ns.getPlayer().money), ns.formatNumber(totalCost));
    return;
  }

  for (const n of nodes) {
    if (!ns.upgradePurchasedServer(n, targetRAM)) {
      ns.tprintf('ERROR Upgrade Failed');
    }
  }
}
