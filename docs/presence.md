# Community presence (maintainers)

Gittensor cut hub weight for **no social presence / not responding in chat**. P0a exit requires documented accounts and a reply streak — not a one-off announcement.

Public page: **`/presence`** (reads [`content/presence.json`](../content/presence.json)).

## SLA

| Rule | Target |
| --- | --- |
| Chat / community reply | **≤ 48h** during active hours |
| Weekly ship note | `/changelog` every week |
| Weekly social post | Mirror the ship note on X (or equivalent) |

SLA clock for this cycle: see `sla_started` in `content/presence.json`.

## Fill accounts

Edit `content/presence.json`:

1. Set `channels[].handle` and `channels[].url` for **X** and **Discord** (or Discord invite + display name).
2. Keep GitHub as the always-on channel.
3. Open a tiny PR titled like `presence: publish X + Discord handles`.

Do **not** invent handles. Pending is better than fake.

## Weekly loop

1. Write the changelog note (`docs/changelog.md`).
2. Post a short X thread linking `/changelog` + one concrete ship.
3. Scan Bittensor/Gittensor chat for hub mentions; reply or ack within 48h.
4. Append an `evidence` row to `content/presence.json`:

   ```json
   {
     "date": "2026-07-28",
     "kind": "reply",
     "summary": "Replied in Gittensor Discord to miner asking about wanted board.",
     "url": "https://…"
   }
   ```

Kinds: `post` | `reply` | `ops`.

## Evidence for re-list

Before filing a weight PR, attach:

- Landing URL + `/changelog` streak (≥4 weeks)
- `/presence` with live handles
- Evidence log covering the lookback window
- Wanted board + merge log

## Local check

```bash
pnpm dev
# http://localhost:12075/presence
```
