import { NS } from '@ns';
import { calculateThreads, Context, dispatch, rootServer, Script } from './lib/utils';
import { dropSecurity, growToMax } from './lib/hacking';
import { findAll, getNode } from './lib/node';

export async function main(ns: NS) {
  const all = findAll(ns);
  for (const n of all) {
    rootServer(ns, n.server);
  }
}
