import { NS } from '@ns';

export async function main(ns: NS) {
  const nodes = ns.getPurchasedServers();
  const lowestMemory = nodes.reduce(
    (lowest, node) => Math.min(lowest, ns.getServer(node).maxRam),
    ns.getServer(nodes[0]).maxRam,
  );
  const node = ns.getServer(nodes.find((node) => ns.getServer(node).maxRam === lowestMemory));
  const targetRAM = node.maxRam * 2;
  const cost = ns.getPurchasedServerUpgradeCost(node.hostname, targetRAM);
  const totalCost = nodes.length * cost;

  ns.tprintf('Cost: %s x %d = %s', ns.formatNumber(cost), nodes.length, ns.formatNumber(totalCost));

  if (ns.getPlayer().money < totalCost) {
    ns.tprintf('ERROR Not enough money: %s < %s', ns.formatNumber(ns.getPlayer().money), ns.formatNumber(totalCost));
    return;
  }

  for (const n of nodes) {
    ns.tprintf('%s: %s', n, ns.formatRam(ns.getServer(n).maxRam));
    if (ns.getServer(n).maxRam === lowestMemory) {
      if (!ns.upgradePurchasedServer(n, targetRAM)) {
        ns.tprintf('ERROR Upgrade Failed');
      }
    }
  }
}
