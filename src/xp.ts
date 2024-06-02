import { NS } from '@ns';
import { calculateThreads, Context, dispatch, rootServer, Script } from './lib/utils';
import { dropSecurity, growToMax } from './lib/hacking';
import { getNode } from './lib/node';

export async function main(ns: NS) {
  const ctx: Context = {
    ns: ns,
    logToTerminal: false,
  };

  const target = ns.getServer('joesguns');

  rootServer(ns, target);

  await dropSecurity(ctx, target.hackDifficulty || 0, target);
  await growToMax(ctx, target);

  while (true) {
    const node = await getNode(ctx, 0);
    const threads = calculateThreads(ns, Script.GROW, node);
    dispatch(ctx, node, target, Script.GROW, threads);
  }
}
