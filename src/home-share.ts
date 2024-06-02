import { NS } from '@ns';
import { calculateThreads, Script } from './lib/utils';

export async function main(ns: NS) {
  const threads = Math.round(calculateThreads(ns, Script.SHARE, ns.getServer()) * 0.95);

  while (true) {
    ns.exec(Script.SHARE, ns.getServer().hostname, { threads });
    await ns.asleep(10);
  }
}
