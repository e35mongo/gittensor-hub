/**
 * Static subnet registry for netuid 1–128.
 *
 * Only curated entries claim `live` / `inactive`. Everything else is an honest
 * `unknown` stub — future pages (#273+) must not invent names for uncurated
 * netuids.
 */

import curatedJson from './curated.json';

export type SubnetStatus = 'live' | 'inactive' | 'unknown';

export type SubnetEntry = {
  netuid: number;
  status: SubnetStatus;
  /** Display name when curated; null for unknown stubs. */
  name: string | null;
  /** One-line description when curated; null for unknown stubs. */
  tagline: string | null;
};

export const MIN_NETUID = 1;
export const MAX_NETUID = 128;

type CuratedSubnet = {
  netuid: number;
  status: Exclude<SubnetStatus, 'unknown'>;
  name: string;
  tagline: string;
};

/** Small curated set for the multi-subnet wedge (SN74 hub + SN66 + SN1). */
const CURATED = curatedJson as readonly CuratedSubnet[];

const CURATED_BY_NETUID = new Map(CURATED.map((entry) => [entry.netuid, entry]));

function stub(netuid: number): SubnetEntry {
  return { netuid, status: 'unknown', name: null, tagline: null };
}

export function isValidNetuid(netuid: number): boolean {
  return Number.isInteger(netuid) && netuid >= MIN_NETUID && netuid <= MAX_NETUID;
}

/** Returns null when `netuid` is outside 1–128. */
export function getSubnet(netuid: number): SubnetEntry | null {
  if (!isValidNetuid(netuid)) return null;
  const curated = CURATED_BY_NETUID.get(netuid);
  if (!curated) return stub(netuid);
  return {
    netuid: curated.netuid,
    status: curated.status,
    name: curated.name,
    tagline: curated.tagline,
  };
}

/** Full registry, netuid ascending (always length 128). */
export function listSubnets(): SubnetEntry[] {
  const out: SubnetEntry[] = [];
  for (let netuid = MIN_NETUID; netuid <= MAX_NETUID; netuid++) {
    const entry = getSubnet(netuid);
    if (entry) out.push(entry);
  }
  return out;
}

/** Invariants for the smoke script / future callers. Throws on failure. */
export function assertRegistryInvariants(): void {
  const all = listSubnets();
  if (all.length !== MAX_NETUID - MIN_NETUID + 1) {
    throw new Error(`expected ${MAX_NETUID - MIN_NETUID + 1} entries, got ${all.length}`);
  }
  for (let i = 0; i < all.length; i++) {
    const entry = all[i]!;
    if (entry.netuid !== i + MIN_NETUID) {
      throw new Error(`listSubnets() out of order at index ${i}: netuid ${entry.netuid}`);
    }
  }
  if (getSubnet(0) !== null || getSubnet(MAX_NETUID + 1) !== null) {
    throw new Error('getSubnet() must return null outside 1–128');
  }
  const sn74 = getSubnet(74);
  if (!sn74 || sn74.status !== 'live' || sn74.name !== 'Gittensor') {
    throw new Error('SN74 must be curated as live Gittensor');
  }
  const sn66 = getSubnet(66);
  if (!sn66 || sn66.status !== 'live' || sn66.name !== 'ninja') {
    throw new Error('SN66 must be curated as live ninja');
  }
  const unknown = getSubnet(99);
  if (!unknown || unknown.status !== 'unknown' || unknown.name !== null || unknown.tagline !== null) {
    throw new Error('uncurated netuids must be honest unknown stubs');
  }
  for (const entry of all) {
    if (entry.status === 'unknown') {
      if (entry.name !== null || entry.tagline !== null) {
        throw new Error(`unknown netuid ${entry.netuid} must not invent name/tagline`);
      }
    } else if (!entry.name || !entry.tagline) {
      throw new Error(`curated netuid ${entry.netuid} needs name + tagline`);
    }
  }
}
