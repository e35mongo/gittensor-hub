import fs from 'node:fs';
import path from 'node:path';

export type PresenceChannel = {
  id: string;
  label: string;
  handle: string | null;
  url: string | null;
  role: string;
};

export type PresenceEvidence = {
  date: string;
  kind: string;
  summary: string;
  url?: string | null;
};

export type PresenceConfig = {
  sla_hours: number;
  sla_started: string;
  active_hours: string;
  channels: PresenceChannel[];
  evidence: PresenceEvidence[];
};

const PRESENCE_PATH = path.join(process.cwd(), 'content', 'presence.json');

export function getPresenceConfig(): PresenceConfig {
  const raw = fs.readFileSync(PRESENCE_PATH, 'utf8');
  const data = JSON.parse(raw) as PresenceConfig;
  if (!Array.isArray(data.channels) || !Array.isArray(data.evidence)) {
    throw new Error('content/presence.json is missing channels or evidence');
  }
  return data;
}

export function formatPresenceDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

export function channelIsLive(channel: PresenceChannel): boolean {
  return Boolean(channel.url && channel.handle);
}
