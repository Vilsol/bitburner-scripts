import { NS } from '@ns';

export async function main(ns: NS) {
  ns.tprintf('Favor required: %d', ns.getFavorToDonate());
}
