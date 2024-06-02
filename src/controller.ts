import { NS, Server } from '@ns';
import { findTarget, getNode, waitForRAM } from './lib/node';
import {
  clone,
  dFormat,
  discoverNodes,
  dispatch,
  getDate,
  rootServer,
  log,
  Script,
  GROW_SECURITY_AMOUNT,
  HACK_SECURITY_AMOUNT,
  WEAKEN_SECURITY_AMOUNT,
  Context,
} from './lib/utils';
import { dropSecurity, growToMax } from './lib/hacking';

const TIME_OFFSET = 150;

const SLEEP_PLAN = TIME_OFFSET;

export async function main(ns: NS) {
  const ctx: Context = {
    ns: ns,
    logToTerminal: false,
  };

  const home = ns.args.length > 0 && ns.args[0] === true;

  ns.tail();

  const target = findTarget(ctx);

  rootServer(ns, target);

  // First drop the security to the lowest possible
  const security = target.hackDifficulty || 0;
  await dropSecurity(ctx, security, target, home);

  // Grow to max money
  await growToMax(ctx, target, home);

  log(ctx, 'SUCCESS Ready to go!');

  const {
    totalRAM,
    hackingThreads,
    hackDelay,
    weakenAfterHackThreads,
    toGrowFromHackThreads,
    growDelay,
    weakenAfterGrowThreads,
    secondWeakenDelay,
    minMemory,
    maxGrowThreads,
    maxWeakenThreads,
    maxHackThreads,
    hackPercent,
    maxHackPercent,
    maxHackMoney,
    finalHackingPercent,
    finalHackMoney,
    hackSecurityIncrease,
    hackTime,
    growSecurityIncrease,
    growTime,
    weakenTime,
  } = calculate(ns, target);

  log(ctx, 'INFO Lowest memory: %s', ns.formatRam(minMemory));

  log(ctx, 'INFO Max grow.js threads: %s', ns.formatNumber(maxGrowThreads));
  log(ctx, 'INFO Max weaken.js threads: %s', ns.formatNumber(maxWeakenThreads));
  log(ctx, 'INFO Max hack.js threads: %s', ns.formatNumber(maxHackThreads));

  log(ctx, 'INFO Hacking with 1 thread would hack %s', ns.formatPercent(hackPercent));

  log(
    ctx,
    'INFO Hacking with %st would hack %s -> %s',
    maxHackThreads,
    ns.formatPercent(maxHackPercent),
    ns.formatNumber(maxHackMoney),
  );

  log(
    ctx,
    'SUCCESS Will hack with %st for %s -> %s and grow with %st',
    hackingThreads,
    ns.formatPercent(finalHackingPercent),
    ns.formatNumber(finalHackMoney),
    toGrowFromHackThreads,
  );

  log(
    ctx,
    'INFO Hacking with %dt increases security by %s and takes %s',
    hackingThreads,
    hackSecurityIncrease,
    ns.tFormat(hackTime, true),
  );

  log(
    ctx,
    'INFO Growing with %dt increases security by %s and takes %s',
    toGrowFromHackThreads,
    growSecurityIncrease,
    ns.tFormat(growTime, true),
  );

  log(ctx, 'INFO Weakening takes %s', ns.tFormat(weakenTime, true));
  log(ctx, 'INFO Need to weaken with %st after hacking', weakenAfterHackThreads);
  log(ctx, 'INFO Need to weaken with %st after growing', weakenAfterGrowThreads);
  log(ctx, 'INFO Requires total of %s of RAM', ns.formatRam(totalRAM));

  log(ctx, '[%s] SCHEDULE:', dFormat(ns, new Date()));

  // Hack
  log(
    ctx,
    '1. Hack with %dt for %s increasing security by %s ending at %s -> delay %s',
    hackingThreads,
    ns.formatNumber(finalHackMoney),
    hackSecurityIncrease,
    dFormat(ns, getDate(weakenTime - TIME_OFFSET)),
    ns.tFormat(hackDelay, true),
  );

  // Weaken from Hack
  log(
    ctx,
    '2. Weaken with %dt decreasing security by %s ending at %s -> no delay',
    weakenAfterHackThreads,
    hackSecurityIncrease,
    dFormat(ns, getDate(weakenTime)),
  );

  // Grow
  log(
    ctx,
    '3. Grow with %dt for %s increasing security by %s ending at %s -> delay %s',
    toGrowFromHackThreads,
    ns.formatNumber(finalHackMoney),
    growSecurityIncrease,
    dFormat(ns, getDate(weakenTime + TIME_OFFSET)),
    ns.tFormat(growDelay, true),
  );

  // Weaken from Grow
  log(
    ctx,
    '4. Weaken with %dt decreasing security by %s ending at %s -> delay %s',
    weakenAfterGrowThreads,
    growSecurityIncrease,
    dFormat(ns, getDate(weakenTime + TIME_OFFSET + TIME_OFFSET)),
    ns.tFormat(secondWeakenDelay, true),
  );

  await runLoop(ctx, target, home);
}

/**
 * Execute an infinite loop against a target
 */
const runLoop = async (ctx: Context, target: Server, home = false) => {
  // let lastComplete = Date.now();

  while (true) {
    const {
      totalRAM,
      ramNeeded,
      hackingThreads,
      hackRAM,
      hackDelay,
      weakenAfterHackThreads,
      weakenRAM,
      toGrowFromHackThreads,
      growRAM,
      growDelay,
      weakenAfterGrowThreads,
      secondWeakenDelay,
    } = calculate(ctx.ns, target);

    log(ctx, 'INFO Waiting for %s RAM', ctx.ns.formatRam(totalRAM));

    await waitForRAM(ctx, ramNeeded, home);

    log(ctx, 'SUCCESS Executing plan');

    // Wait until node has min security
    // eslint-disable-next-line no-async-promise-executor
    await new Promise<void>(async (r): Promise<void> => {
      while (true) {
        const n = ctx.ns.getServer(target.hostname);
        if (n.minDifficulty === n.hackDifficulty) {
          return r();
        }
        await ctx.ns.asleep(25);
      }
    });

    const delaySinceLast = 0;
    // const delaySinceLast = Math.max(0, TIME_OFFSET + (lastComplete - Date.now()));
    // log(ns, 'INFO Offset: %s', ns.tFormat(delaySinceLast, true));

    // 1. Hack
    const hackNode = await getNode(ctx, hackingThreads * hackRAM, true);
    dispatch(ctx, hackNode, target, Script.HACK, hackingThreads, hackDelay + delaySinceLast);

    // 2. Weaken
    const weaken1Node = await getNode(ctx, weakenAfterHackThreads * weakenRAM, true);
    dispatch(ctx, weaken1Node, target, Script.WEAKEN, weakenAfterHackThreads + delaySinceLast);

    // 3. Grow
    const growNode = await getNode(ctx, toGrowFromHackThreads * growRAM, true);
    dispatch(ctx, growNode, target, Script.GROW, toGrowFromHackThreads, growDelay + delaySinceLast);

    // 4. Weaken
    const weaken2Node = await getNode(ctx, weakenAfterGrowThreads * weakenRAM, true);
    dispatch(ctx, weaken2Node, target, Script.WEAKEN, weakenAfterGrowThreads, secondWeakenDelay + delaySinceLast);

    // Sleep to not collide with next execution
    log(ctx, 'INFO Sleeping %s', ctx.ns.tFormat(SLEEP_PLAN, true));
    await ctx.ns.asleep(SLEEP_PLAN);

    // Yield
    // await ns.asleep(50);
    //
    // lastComplete = Date.now();
  }
};

/**
 * Calculate all dynamic variables needed for execution
 */
const calculate = (ns: NS, target: Server) => {
  const clean = clone(ns, target);
  target.moneyAvailable = target.moneyMax;
  target.hackDifficulty = target.minDifficulty;

  const nodes = discoverNodes(ns);

  const minMemory = nodes.reduce((n, node) => Math.min(n, node.maxRam), Number.MAX_SAFE_INTEGER);

  const growRAM = ns.getScriptRam('grow.js');
  const weakenRAM = ns.getScriptRam('weaken.js');
  const hackRAM = ns.getScriptRam('hack.js');

  const maxGrowThreads = Math.floor(minMemory / growRAM);
  const maxWeakenThreads = Math.floor(minMemory / weakenRAM);
  const maxHackThreads = Math.floor(minMemory / hackRAM);

  const hackPercent = ns.formulas.hacking.hackPercent(target, ns.getPlayer());

  const maxHackPercent = maxHackThreads * hackPercent;
  const maxHackMoney = maxHackPercent * (target.moneyMax || 0);

  let hackingThreads = maxHackThreads;
  let finalHackingPercent = maxHackPercent;
  let finalHackMoney = maxHackMoney;
  if (maxHackPercent > 0.9) {
    finalHackingPercent = 0.9;
    hackingThreads = Math.floor(finalHackingPercent / hackPercent);
    finalHackMoney = finalHackingPercent * (target.moneyMax || 0);
  }

  const fake = clone(ns, target);
  fake.moneyAvailable = (fake.moneyMax || 0) - finalHackMoney;

  let toGrowFromHackThreads = ns.formulas.hacking.growThreads(fake, ns.getPlayer(), target.moneyMax || 0) + 1;

  if (toGrowFromHackThreads > maxGrowThreads) {
    // oof, snap to max grow threads
    toGrowFromHackThreads = maxGrowThreads;
    const growPercent = ns.formulas.hacking.growPercent(fake, toGrowFromHackThreads - 1, ns.getPlayer());

    finalHackingPercent = 1 / growPercent;
    hackingThreads = Math.floor(finalHackingPercent / hackPercent);
    finalHackMoney = finalHackingPercent * (target.moneyMax || 0);
  }

  const hackTime = ns.formulas.hacking.hackTime(clean, ns.getPlayer());
  const hackSecurityIncrease = HACK_SECURITY_AMOUNT * hackingThreads;

  const growTime = ns.formulas.hacking.growTime(clean, ns.getPlayer());
  const growSecurityIncrease = GROW_SECURITY_AMOUNT * toGrowFromHackThreads;

  const weakenTime = ns.formulas.hacking.weakenTime(clean, ns.getPlayer());

  const weakenAfterHackThreads = Math.ceil(hackSecurityIncrease / WEAKEN_SECURITY_AMOUNT);

  const weakenAfterGrowThreads = Math.ceil(growSecurityIncrease / WEAKEN_SECURITY_AMOUNT) + 1;

  const ramNeeded = [
    hackingThreads * hackRAM,
    weakenAfterHackThreads * weakenRAM,
    toGrowFromHackThreads * growRAM,
    weakenAfterGrowThreads * weakenRAM,
  ];

  const totalRAM = ramNeeded.reduce((s, ram) => s + ram, 0);

  const hackDelay = weakenTime - TIME_OFFSET - hackTime;
  const growDelay = weakenTime + TIME_OFFSET - growTime;
  const secondWeakenDelay = TIME_OFFSET + TIME_OFFSET;

  return {
    totalRAM,
    ramNeeded,
    hackingThreads,
    hackRAM,
    hackDelay,
    weakenAfterHackThreads,
    weakenRAM,
    toGrowFromHackThreads,
    growRAM,
    growDelay,
    weakenAfterGrowThreads,
    secondWeakenDelay,
    minMemory,
    maxGrowThreads,
    maxWeakenThreads,
    maxHackThreads,
    hackPercent,
    maxHackPercent,
    maxHackMoney,
    finalHackingPercent,
    finalHackMoney,
    hackSecurityIncrease,
    hackTime,
    growSecurityIncrease,
    growTime,
    weakenTime,
  };
};
