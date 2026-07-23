# Status (poller freshness)

Public page: **`/status`**.

Shows whether the GitHub poller / SQLite cache is healthy for the live SN74 repo set.

| Signal | Meaning |
| --- | --- |
| Healthy | Last issues fetch within 30 minutes, repos cached, no open fetch errors |
| Degraded | Stale fetch, zero coverage, or recent `last_fetch_error` rows |
| Unknown | No successful fetch timestamp yet |

Data: `GET /api/public/poller-status` (also used by the signed-in poller bar via `/api/poller-status`).
