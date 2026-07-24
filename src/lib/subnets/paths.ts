import { listSubnets, type SubnetEntry } from '@/lib/subnets/registry';
import { SN74_NETUID } from '@/lib/nav';

export function subnetPath(netuid: number): string {
  return `/subnet/${netuid}`;
}

/** Default landing when entering Network scope. */
export function defaultNetworkPath(): string {
  return subnetPath(SN74_NETUID);
}

export function parseNetuidFromPath(pathname: string): number | null {
  const match = pathname.match(/^\/subnet\/(\d+)(?:\/|$)/);
  if (!match) return null;
  const netuid = Number(match[1]);
  return Number.isInteger(netuid) ? netuid : null;
}

/** Live first (ascending netuid), then the rest ascending. */
export function listSubnetsForSidebar(): SubnetEntry[] {
  const all = listSubnets();
  const live = all.filter((e) => e.status === 'live');
  const rest = all.filter((e) => e.status !== 'live');
  return [...live, ...rest];
}
