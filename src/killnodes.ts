import { NS } from '@ns';
import { discoverNodes } from './lib/utils';

export async function main(ns: NS) {
  for (const node of discoverNodes(ns)) {
    ns.killall(node.hostname);
  }
}
