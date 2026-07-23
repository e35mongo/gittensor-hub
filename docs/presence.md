# Community presence (maintainers)

Gittensor cut hub weight for **no social presence / not responding in chat**. P0a exit requires documented accounts and a reply streak — not a one-off announcement.

Public page: **`/presence`** (reads [`content/presence.json`](../content/presence.json)).

## Channels (current)

| Channel | Status |
| --- | --- |
| GitHub | Live |
| Gittensor Discord | Live — https://discord.gg/mAXpcvAcZ |
| X | **Deferred** for now (do not list as pending on `/presence`) |

## SLA

| Rule | Target |
| --- | --- |
| Chat / community reply | **≤ 48h** during active hours (Discord + GitHub) |
| Weekly ship note | `/changelog` every week |

SLA clock for this cycle: see `sla_started` in `content/presence.json`.

## Weekly loop

1. Write the changelog note (`docs/changelog.md`).
2. Scan Gittensor Discord for hub mentions; reply or ack within 48h.
3. Append an `evidence` row to `content/presence.json`:

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
- `/presence` with live GitHub + Discord
- Evidence log covering the lookback window (Discord replies count)
- Wanted board + merge log

## Local check

```bash
pnpm dev
# http://localhost:12075/presence
```
