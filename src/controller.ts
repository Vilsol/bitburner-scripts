import { NS, Server } from '@ns';
import { findTarget, getNode, waitForRAM } from './lib/node';
import {
  clone,
  dFormat,
  discoverNodes,
  dispatch,
  getDate,
  rootServer,
  Script,
  GROW_SECURITY_AMOUNT,
  HACK_SECURITY_AMOUNT,
  WEAKEN_SECURITY_AMOUNT,
} from './lib/utils';
import { dropSecurity, growToMax } from './lib/hacking';

const TIME_OFFSET = 200;

// Sleep for 3x instructions + buffer
const SLEEP_PLAN = TIME_OFFSET * 4;

export async function main(ns: NS) {
  const target = findTarget(ns);

  rootServer(ns, target);

  // First drop the security to the lowest possible
  const security = target.hackDifficulty || 0;
  await dropSecurity(ns, security, target);

  // Grow to max money
  await growToMax(ns, target);

  ns.tprintf('SUCCESS Ready to go!');

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

  ns.tprintf('INFO Lowest memory: %s', ns.formatRam(minMemory));

  ns.tprintf('INFO Max grow.js threads: %s', ns.formatNumber(maxGrowThreads));
  ns.tprintf('INFO Max weaken.js threads: %s', ns.formatNumber(maxWeakenThreads));
  ns.tprintf('INFO Max hack.js threads: %s', ns.formatNumber(maxHackThreads));

  ns.tprintf('INFO Hacking with 1 thread would hack %s', ns.formatPercent(hackPercent));

  ns.tprintf(
    'INFO Hacking with %st would hack %s -> %s',
    maxHackThreads,
    ns.formatPercent(maxHackPercent),
    ns.formatNumber(maxHackMoney),
  );

  ns.tprintf(
    'SUCCESS Will hack with %st for %s -> %s and grow with %st',
    hackingThreads,
    ns.formatPercent(finalHackingPercent),
    ns.formatNumber(finalHackMoney),
    toGrowFromHackThreads,
  );

  ns.tprintf(
    'INFO Hacking with %dt increases security by %s and takes %s',
    hackingThreads,
    hackSecurityIncrease,
    ns.tFormat(hackTime, true),
  );

  ns.tprintf(
    'INFO Growing with %dt increases security by %s and takes %s',
    toGrowFromHackThreads,
    growSecurityIncrease,
    ns.tFormat(growTime, true),
  );

  ns.tprintf('INFO Weakening takes %s', ns.tFormat(weakenTime, true));
  ns.tprintf('INFO Need to weaken with %st after hacking', weakenAfterHackThreads);
  ns.tprintf('INFO Need to weaken with %st after growing', weakenAfterGrowThreads);
  ns.tprintf('INFO Requires total of %s of RAM', ns.formatRam(totalRAM));

  ns.tprintf('[%s] SCHEDULE:', dFormat(ns, new Date()));

  // Hack
  ns.tprintf(
    '1. Hack with %dt for %s increasing security by %s ending at %s -> delay %s',
    hackingThreads,
    ns.formatNumber(finalHackMoney),
    hackSecurityIncrease,
    dFormat(ns, getDate(weakenTime - TIME_OFFSET)),
    ns.tFormat(hackDelay, true),
  );

  // Weaken from Hack
  ns.tprintf(
    '2. Weaken with %dt decreasing security by %s ending at %s -> no delay',
    weakenAfterHackThreads,
    hackSecurityIncrease,
    dFormat(ns, getDate(weakenTime)),
  );

  // Grow
  ns.tprintf(
    '3. Grow with %dt for %s increasing security by %s ending at %s -> delay %s',
    toGrowFromHackThreads,
    ns.formatNumber(finalHackMoney),
    growSecurityIncrease,
    dFormat(ns, getDate(weakenTime + TIME_OFFSET)),
    ns.tFormat(growDelay, true),
  );

  // Weaken from Grow
  ns.tprintf(
    '4. Weaken with %dt decreasing security by %s ending at %s -> delay %s',
    weakenAfterGrowThreads,
    growSecurityIncrease,
    dFormat(ns, getDate(weakenTime + TIME_OFFSET + TIME_OFFSET)),
    ns.tFormat(secondWeakenDelay, true),
  );

  await runLoop(ns, target);
}

/**
 * Execute an infinite loop against a target
 */
const runLoop = async (ns: NS, target: Server) => {
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
    } = calculate(ns, target);

    ns.tprintf('INFO Waiting for %s RAM', ns.formatRam(totalRAM));

    await waitForRAM(ns, ramNeeded);

    ns.tprintf('SUCCESS Executing plan');

    // 1. Hack
    const hackNode = await getNode(ns, hackingThreads * hackRAM);
    dispatch(ns, hackNode, target, Script.HACK, hackingThreads, hackDelay);

    // 2. Weaken
    const weaken1Node = await getNode(ns, weakenAfterHackThreads * weakenRAM);
    dispatch(ns, weaken1Node, target, Script.WEAKEN, weakenAfterHackThreads);

    // 3. Grow
    const growNode = await getNode(ns, toGrowFromHackThreads * growRAM);
    dispatch(ns, growNode, target, Script.GROW, toGrowFromHackThreads, growDelay);

    // 4. Weaken
    const weaken2Node = await getNode(ns, weakenAfterGrowThreads * weakenRAM);
    dispatch(ns, weaken2Node, target, Script.WEAKEN, weakenAfterGrowThreads, secondWeakenDelay);

    // Sleep to not collide with next execution
    ns.tprintf('INFO Sleeping %s', ns.tFormat(SLEEP_PLAN, true));
    await ns.asleep(SLEEP_PLAN);
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
    hackingThreads = Math.floor(0.9 / hackPercent);
    finalHackingPercent = hackingThreads * hackPercent;
    finalHackMoney = finalHackingPercent * (target.moneyMax || 0);
  }

  const fake = clone(ns, target);
  fake.moneyAvailable = (fake.moneyMax || 0) - finalHackMoney;

  const toGrowFromHackThreads = ns.formulas.hacking.growThreads(fake, ns.getPlayer(), target.moneyMax || 0) + 1;

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
