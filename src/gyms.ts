import { NS } from '@ns';

export async function main(ns: NS) {
  for (const name in ns.enums.LocationName) {
    if (name.toLowerCase().indexOf('gym') >= 0) {
      const loc = (ns.enums.LocationName as any)[name];
      if (loc) {
        const workStats = ns.formulas.work.gymGains(ns.getPlayer(), ns.enums.GymType.dexterity, loc);
        ns.tprintf('%s: %s', loc, JSON.stringify(workStats));
      } else {
        ns.tprintf('missing: %s', name);
      }
    }
  }
}
