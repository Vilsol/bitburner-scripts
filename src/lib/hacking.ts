import { NS, Server } from '@ns';
import { getNode } from './node';
import { calculateThreads, dispatch, getDate, Script } from './utils';

/**
 * Drop target security to minimum
 */
export const dropSecurity = async (ns: NS, security: number, target: Server): Promise<number> => {
  if (security > (target.minDifficulty || 0)) {
    ns.tprintf(
      'INFO Dropping security from %s to %s',
      ns.formatNumber(security),
      ns.formatNumber(target.minDifficulty || 0),
    );

    let longest = 0;
    while (security > (target.minDifficulty || 0)) {
      const node = await getNode(ns, 0);
      const threads = calculateThreads(ns, Script.WEAKEN, node);

      security -= ns.weakenAnalyze(threads);

      longest = ns.getWeakenTime(target.hostname);

      weaken(ns, node, target, threads);
    }

    ns.tprintf(
      'INFO Waiting for %s for security to drop -> %s',
      ns.tFormat(longest),
      getDate(longest).toLocaleTimeString(),
    );

    await ns.asleep(longest);
  }

  return security;
};

/**
 * Grow to max money and drop security
 */
export const growToMax = async (ns: NS, target: Server) => {
  if ((target.moneyAvailable || 0) < (target.moneyMax || 0)) {
    let longest = 0;
    let threadsNeeded = ns.growthAnalyze(target.hostname, (target.moneyMax || 1) / (target.moneyAvailable || 1));
    let security = target.minDifficulty || 0;
    while (threadsNeeded > 0) {
      const node = await getNode(ns, 0);
      const threads = calculateThreads(ns, Script.GROW, node);

      threadsNeeded -= threads;

      security += ns.growthAnalyzeSecurity(threads);

      longest = ns.getGrowTime(target.hostname);

      dispatch(ns, node, target, Script.GROW, threads);
    }

    ns.tprintf(
      'INFO Waiting for %s for money to grow -> %s',
      ns.tFormat(longest),
      getDate(longest).toLocaleTimeString(),
    );

    // Can execute security immediately as weaken always takes longer
    await dropSecurity(ns, security, target);
  }
};

/**
 * Weaken target
 */
export const weaken = (ns: NS, node: Server, target: Server, threads: number) => {
  ns.tprintf('INFO Weakening %s by %s', target.hostname, ns.formatNumber(ns.weakenAnalyze(threads)));
  dispatch(ns, node, target, Script.WEAKEN, threads);
};
