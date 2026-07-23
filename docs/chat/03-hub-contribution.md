# Contributing to Gittensor Hub (anti-slop)

Gittensor Hub wants **compounding product work**, not AI drive-by noise.

## Do this

1. Pick an open [`gittensor-hub:wanted`](https://github.com/e35mongo/gittensor-hub/labels/gittensor-hub%3Awanted) or `help wanted` / `good first issue`.
2. Link that **currently open** issue from your PR (`Closes #N`).
3. Keep the diff focused; include screenshots for user-visible UI.
4. Pass `pnpm run lint` and `pnpm build`.

## Do not do this

- Unsolicited refactors, typo farms, README spam → labeled `slop`, score **0**, usually closed.
- `maintainer-only` work → **no** miner / Hub Score points.
- More than **5** open PRs per author (policy bot enforced).
- Unrelated UI on a backend/docs issue (jagtensor flags).

## Labels that matter

| Label | Meaning |
| --- | --- |
| `gittensor-hub:wanted` | Maintainer-requested — high-score eligible gate |
| `gittensor:bug` / `gittensor:feature` | Accepted bug/feature paths |
| `slop` | Zero score |
| `maintainer-only` | Owner work — zero miner score |

When this repo is Gittensor-listed, validator `label_multipliers` should mirror these names. **A merge is not a promise of TAO.**

## Presence

Public pages: `/` (landing), `/changelog`, `/presence` (≤48h Discord/GitHub SLA). Community Discord: https://discord.gg/mAXpcvAcZ

## Sources

- `CONTRIBUTING.md`
- `docs/github-os.md`
- `docs/bots.md`
- `docs/presence.md`
