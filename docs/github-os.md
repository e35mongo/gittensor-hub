# GitHub operating system (hub)

This repo’s Issues / Labels / Milestones are a **contributor flywheel** — curated wanted work, clear labels, and automation so miners get real tasks instead of AI drive-by noise.

## Labels

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the scoring-relevant set. Trust / triage labels:

* `pr:verified` / `pr:flagged`
* `contributor:verified` / `contributor:flagged`
* `manual-review`, `banned`
* `status: waiting-on-author`
* Area: `backend`, `frontend`, `docs`, `roadmap`

Detailed PR taxonomy (size, surface, jaguar findings, review lifecycle): [docs/pr-labels.md](./pr-labels.md) · seed [`.github/pr-labels.json`](../.github/pr-labels.json).

## Milestones

| Milestone | Purpose |
| --- | --- |
| Presence & Re-list | Landing, changelog, social proof, weight evidence |
| Platform Foundation | Chatbot, docs, status, My Work |
| Multi-subnet Wedge | Registry + SN66 + generic metagraph |
| Contribution Network | Hub Scores, enrolled repos, wanted board |
| Review Automation | Auto-review / depth rubric |

## Saved issue views (create in GitHub UI)

GitHub does not version saved views in-repo. Create these under **Issues → Views** (or search bookmarks):

1. **Wanted (miner work)**  
   `is:issue is:open label:gittensor-hub:wanted -label:maintainer-only`

2. **Good first**  
   `is:issue is:open label:"good first issue"`

3. **Help wanted**  
   `is:issue is:open label:"help wanted" -label:maintainer-only`

4. **Roadmap epics**  
   `is:issue is:open label:roadmap`

5. **Maintainer only**  
   `is:issue is:open label:maintainer-only`

6. **Enforcement**  
   `is:issue is:open label:slop OR label:banned OR label:pr:flagged`

## Automation

| Workflow | Role |
| --- | --- |
| `wanted-buffer.yml` | Weekly: ensure open `gittensor-hub:wanted` count meets the floor from `.github/wanted-backlog.json` |
| `pr-jaguar-policy.yml` | jaguar gates: linked issue, UI scope, screenshots, size, protected paths, ≤2 open PRs |
| `build.yml` | Lint / typecheck / build |

Bot identity + optional LoopOver: see [docs/bots.md](./bots.md). Policy comments speak as **jaguar[bot]** once `JAGUAR_APP_*` secrets are set.

## Wanted buffer

Curated seeds live in [`.github/wanted-backlog.json`](../.github/wanted-backlog.json). Maintainers edit that file; the weekly workflow opens missing issues labeled `gittensor-hub:wanted` + `help wanted`.
