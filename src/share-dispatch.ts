import { NS } from '@ns';
import { calculateThreads, Context, Script } from './lib/utils';
import { getNode } from './lib/node';

export async function main(ns: NS) {
  const ctx: Context = {
    ns: ns,
    logToTerminal: false,
  };

  while (true) {
    const node = await getNode(ctx, 0);
    const threads = calculateThreads(ns, Script.SHARE, node);
    ctx.ns.scp(Script.SHARE, node.hostname, 'home');
    ns.exec(Script.SHARE, node.hostname, { threads });
    await ns.asleep(10);
  }
}
