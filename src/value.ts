import { NS } from '@ns';
import { Context } from './lib/utils';
import { findTarget } from './lib/node';

export async function main(ns: NS) {
  const ctx: Context = {
    ns: ns,
    logToTerminal: false,
  };
  findTarget(ctx);
}
