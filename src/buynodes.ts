import { NS } from '@ns';
import { discoverNodes } from './lib/utils';

export async function main(ns: NS) {
  const count = ns.args[0] as number;
  const limit = ns.getPurchasedServerLimit();
  const exist = ns.getPurchasedServers().length;

  if (count + exist > limit) {
    ns.tprintf('ERROR Server limit: %d > %d', count + exist, limit);
    return;
  }

  const highest = discoverNodes(ns).reduce((n, node) => {
    return Math.max(n, parseInt(node.hostname.substring(4), 10));
  }, 0);

  const start = highest + 1;

  for (let i = start; i < count + start; i++) {
    ns.purchaseServer('node' + i, 1024);
  }
}
