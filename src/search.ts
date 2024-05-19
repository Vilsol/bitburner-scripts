import { NS } from '@ns';
import { findAll } from './lib/node';
import { canHack } from './lib/utils';

export async function main(ns: NS) {
  findAll(ns)
    .sort((a, b) => {
      return (a.server.moneyMax || 0) - (b.server.moneyMax || 0);
    })
    .forEach((server) => {
      if (server.server.moneyMax) {
        const level = canHack(ns, server.server) ? 'SUCCESS' : 'INFO';
        ns.tprintf(
          '%s [%s](%d) Max Money: %s, Min Diff: %s (%s)',
          level,
          server.server.hostname,
          server.server.requiredHackingSkill || 0,
          ns.formatNumber(server.server.moneyMax || 0),
          ns.formatNumber(server.server.minDifficulty || 0),
          server.path.join(', '),
        );
      }
    });
}
