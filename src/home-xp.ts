import { NS } from '@ns';
import { calculateThreads, Context, dispatch, rootServer, Script } from './lib/utils';

export async function main(ns: NS) {
  const ctx: Context = {
    ns: ns,
    logToTerminal: false,
  };

  const target = ns.getServer('joesguns');

  rootServer(ns, target);

  const growThreads = calculateThreads(ns, Script.GROW, ns.getServer()) * 0.95;
  dispatch(ctx, ns.getServer(), target, Script.GROW, Math.round(growThreads));

  const weakenThreads = calculateThreads(ns, Script.WEAKEN, ns.getServer()) * 0.95;
  dispatch(ctx, ns.getServer(), target, Script.WEAKEN, Math.round(weakenThreads));

  while (true) {
    dispatch(ctx, ns.getServer(), target, Script.GROW, Math.round(growThreads));
    await ns.asleep(100);
  }
}
