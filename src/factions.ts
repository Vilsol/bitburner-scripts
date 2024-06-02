import { NS } from '@ns';
import { findAll } from './lib/node';
import { canHack, rootServer } from './lib/utils';

export async function main(ns: NS) {
  for (const server of findAll(ns)) {
    if (server.server.backdoorInstalled || server.server.purchasedByPlayer) {
      continue;
    }

    if (canHack(ns, server.server)) {
      rootServer(ns, server.server);

      ns.tprintf('WARN: connect %s;hack', [...server.path, server.server.hostname].join(';connect '));

      // ns.singularity.connect('home');
      //
      // for (const n of server.path) {
      //   if (!ns.singularity.connect(n)) {
      //     ns.tprintf('ERROR Cannot connect to: %s', n);
      //     return;
      //   }
      // }
      //
      // ns.singularity.connect(server.server.hostname);
      //
      // ns.tprintf('INFO Hacking: %s', server.server.hostname);
      // await ns.singularity.manualHack();
      // ns.tprintf('SUCCESS Hacked: %s', server.server.hostname);

      await new Promise<void>(async (r) => {
        while (true) {
          if (ns.getServer(server.server.hostname).backdoorInstalled) {
            r();
          }
          await ns.asleep(1000);
        }
      });
    } else {
      ns.tprintf('ERROR Failed to hack server: %s', server.server.hostname);
    }
  }
}
