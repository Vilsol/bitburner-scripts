import { NS } from '@ns';

export async function main(ns: NS) {
  const infiltrations = ns.infiltration
    .getPossibleLocations()
    .map((l) => ns.infiltration.getInfiltration(l.name))
    .sort((a, b) => a.reward.tradeRep - b.reward.tradeRep);
  for (const infiltration of infiltrations) {
    ns.tprintf(
      '%-7s %10s, %25s:  T: %8s  SoA: %7s  Diff: %.3f, %d, %d',
      infiltration.difficulty < 3 ? 'SUCCESS' : 'INFO',
      infiltration.location.city,
      infiltration.location.name,
      ns.formatNumber(infiltration.reward.tradeRep),
      ns.formatNumber(infiltration.reward.SoARep),
      infiltration.difficulty,
      infiltration.maxClearanceLevel,
      infiltration.startingSecurityLevel,
    );
  }
}
