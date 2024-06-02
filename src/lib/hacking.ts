import { Server } from '@ns';
import { getNode } from './node';
import { Context, dispatch, getDate, log, Script, WEAKEN_SECURITY_AMOUNT } from './utils';

/**
 * Drop target security to minimum
 */
export const dropSecurity = async (ctx: Context, security: number, target: Server, home = false): Promise<number> => {
  if (security > (target.minDifficulty || 0)) {
    log(
      ctx,
      'INFO Dropping security from %s to %s',
      ctx.ns.formatNumber(security),
      ctx.ns.formatNumber(target.minDifficulty || 0),
    );

    let longest = 0;
    while (security > (target.minDifficulty || 0)) {
      const neededThreads = Math.ceil(security / WEAKEN_SECURITY_AMOUNT);
      const neededMemory = neededThreads * ctx.ns.getScriptRam(Script.WEAKEN);

      const node = await getNode(ctx, neededMemory, home);

      security -= ctx.ns.weakenAnalyze(neededThreads);

      longest = ctx.ns.getWeakenTime(target.hostname);

      weaken(ctx, node, target, neededThreads);
    }

    log(
      ctx,
      'INFO Waiting for %s for security to drop -> %s',
      ctx.ns.tFormat(longest),
      getDate(longest).toLocaleTimeString(),
    );

    await ctx.ns.asleep(longest);
  }

  return security;
};

/**
 * Grow to max money and drop security
 */
export const growToMax = async (ctx: Context, target: Server, home = false) => {
  if ((target.moneyAvailable || 0) < (target.moneyMax || 0)) {
    let longest = 0;
    let threadsNeeded = ctx.ns.growthAnalyze(target.hostname, (target.moneyMax || 1) / (target.moneyAvailable || 1));
    let security = target.minDifficulty || 0;
    while (threadsNeeded > 0) {
      const neededThreads = ctx.ns.formulas.hacking.growThreads(target, ctx.ns.getPlayer(), target.moneyMax || 0);
      const neededMemory = neededThreads * ctx.ns.getScriptRam(Script.GROW);

      const node = await getNode(ctx, neededMemory, home);

      threadsNeeded -= neededThreads;

      security += ctx.ns.growthAnalyzeSecurity(neededThreads);

      longest = ctx.ns.getGrowTime(target.hostname);

      dispatch(ctx, node, target, Script.GROW, neededThreads);
    }

    log(
      ctx,
      'INFO Waiting for %s for money to grow -> %s',
      ctx.ns.tFormat(longest),
      getDate(longest).toLocaleTimeString(),
    );

    // Can execute security immediately as weaken always takes longer
    await dropSecurity(ctx, security, target, home);
  }
};

/**
 * Weaken target
 */
export const weaken = (ctx: Context, node: Server, target: Server, threads: number) => {
  log(ctx, 'INFO Weakening %s by %s', target.hostname, ctx.ns.formatNumber(ctx.ns.weakenAnalyze(threads)));
  dispatch(ctx, node, target, Script.WEAKEN, threads);
};
