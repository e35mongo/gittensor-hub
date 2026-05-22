// Miners feature data shapes. Derivations in ./helpers, tokens in ./tokens.
// Miner / MinerTopRepo are the canonical wire types — re-exported, not duplicated.
export type { Miner, MinerTopRepo } from '@/types/entities';

export type Mode = 'total' | 'oss' | 'discovery';

export interface MinerView {
  mode: Mode;
  score: number;
  cred: number;
  eligible: boolean;
  usd: number;
  counts: {
    primaryLabel: 'Merged' | 'Solved' | 'Done';
    primary: number;
    open: number;
    closed: number;
  };
}

// Semantic tone names; CSS values in ./tokens.
export type Tone = 'neutral' | 'success' | 'danger' | 'done' | 'accent';

// Sort direction shared across table headers and SortControl.
export type SortDir = 'asc' | 'desc';

// Column header alignment shared across table headers.
export type ColumnAlign = 'left' | 'right' | 'center';
