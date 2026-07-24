import {
  StackIcon,
  GlobeIcon,
  ChecklistIcon,
  BookIcon,
  PeopleIcon,
  ShieldCheckIcon,
  GearIcon,
  VersionsIcon,
} from '@primer/octicons-react';
import type { Icon } from '@primer/octicons-react';

export type NavItem = {
  href: string;
  label: string;
  icon: Icon;
};

/** SN74-first-class hub surfaces (existing dashboard experience). */
export const SN74_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: ChecklistIcon },
  { href: '/explorer', label: 'Explorer', icon: GlobeIcon },
  { href: '/miners', label: 'Miners', icon: PeopleIcon },
  { href: '/maintainers', label: 'Maintainers', icon: ShieldCheckIcon },
  { href: '/repositories', label: 'Repositories', icon: StackIcon },
];

/** Multi-subnet wedge — registry / future metagraph, not SN74 ops. */
export const NETWORK_NAV: NavItem[] = [
  { href: '/subnets', label: 'Subnets', icon: VersionsIcon },
];

export const UTILITY_NAV: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: GearIcon },
  { href: '/docs', label: 'Docs', icon: BookIcon },
];

export const SN74_NETUID = 74;

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/');
}

/** True on /subnets or /subnet/... — network scope, not SN74 ops. */
export function isNetworkScope(pathname: string): boolean {
  return pathname === '/subnets' || pathname.startsWith('/subnets/') || pathname.startsWith('/subnet/');
}

export function isSn74Scope(pathname: string): boolean {
  return !isNetworkScope(pathname);
}
