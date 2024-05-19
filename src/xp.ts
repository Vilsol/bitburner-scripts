import { NS } from '@ns';
import { calculateThreads, dispatch, rootServer, Script } from './lib/utils';
import { dropSecurity, growToMax } from './lib/hacking';
import { getNode } from './lib/node';

export async function main(ns: NS) {
  const target = ns.getServer('joesguns');

  rootServer(ns, target);

  await dropSecurity(ns, target.hackDifficulty || 0, target);
  await growToMax(ns, target);

  while (true) {
    const node = await getNode(ns, 0);
    const threads = calculateThreads(ns, Script.WEAKEN, node);
    dispatch(ns, node, target, Script.GROW, threads);
  }
}
