/**
 * Tiny smoke assert for the subnet registry (issue #272).
 * Mirrors src/lib/subnets/registry.ts against curated.json — run without a TS loader.
 *
 * Run: pnpm test:subnet-registry
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN_NETUID = 1;
const MAX_NETUID = 128;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const curated = JSON.parse(readFileSync(join(root, 'src/lib/subnets/curated.json'), 'utf8'));

function parseCurated(raw) {
  if (!Array.isArray(raw)) throw new Error('curated.json must be an array');
  const seen = new Set();
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== 'object') throw new Error(`curated.json[${i}] must be an object`);
    const { netuid, status, name, tagline } = row;
    if (!Number.isInteger(netuid)) throw new Error(`curated.json[${i}].netuid must be an integer`);
    if (netuid < MIN_NETUID || netuid > MAX_NETUID) {
      throw new Error(`curated.json[${i}].netuid ${netuid} out of range`);
    }
    if (seen.has(netuid)) throw new Error(`curated.json duplicate netuid ${netuid}`);
    seen.add(netuid);
    if (status !== 'live' && status !== 'inactive') {
      throw new Error(`curated.json[${i}].status must be live|inactive`);
    }
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error(`curated.json[${i}].name must be a non-empty string`);
    }
    if (typeof tagline !== 'string' || !tagline.trim()) {
      throw new Error(`curated.json[${i}].tagline must be a non-empty string`);
    }
    out.push({ netuid, status, name: name.trim(), tagline: tagline.trim() });
  }
  return out;
}

const curatedRows = parseCurated(curated);
const byNetuid = new Map(curatedRows.map((e) => [e.netuid, e]));

function isValidNetuid(netuid) {
  return Number.isInteger(netuid) && netuid >= MIN_NETUID && netuid <= MAX_NETUID;
}

function getSubnet(netuid) {
  if (!isValidNetuid(netuid)) return null;
  const curatedEntry = byNetuid.get(netuid);
  if (!curatedEntry) return { netuid, status: 'unknown', name: null, tagline: null };
  return {
    netuid: curatedEntry.netuid,
    status: curatedEntry.status,
    name: curatedEntry.name,
    tagline: curatedEntry.tagline,
  };
}

function listSubnets() {
  const out = [];
  for (let netuid = MIN_NETUID; netuid <= MAX_NETUID; netuid++) out.push(getSubnet(netuid));
  return out;
}

function assertRegistryInvariants() {
  parseCurated(curated);
  const all = listSubnets();
  if (all.length !== MAX_NETUID - MIN_NETUID + 1) {
    throw new Error(`expected ${MAX_NETUID - MIN_NETUID + 1} entries, got ${all.length}`);
  }
  for (let i = 0; i < all.length; i++) {
    if (all[i].netuid !== i + MIN_NETUID) {
      throw new Error(`listSubnets() out of order at index ${i}: netuid ${all[i].netuid}`);
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
  // curated.json row shape already validated via parseCurated() above.
}

assertRegistryInvariants();
const curatedCount = listSubnets().filter((s) => s.status !== 'unknown').length;
console.log(`subnet registry ok — ${listSubnets().length} netuids, ${curatedCount} curated`);
