# GitHub operating system (hub)

This repo’s Issues / Labels / Milestones are a **contributor flywheel** — curated wanted work, clear labels, and automation so miners get real tasks instead of AI drive-by noise.

## Labels

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the scoring-relevant set. Trust / triage labels:

* `pr:verified` / `pr:flagged`
* `contributor:verified` / `contributor:flagged`
* `manual-review`, `banned`
* `status: waiting-on-author`
* Area: `backend`, `frontend`, `docs`, `roadmap`

Detailed PR taxonomy (size, surface, jagtensor findings, review lifecycle): [docs/pr-labels.md](./pr-labels.md) · seed [`.github/pr-labels.json`](../.github/pr-labels.json).

## Milestones

| Milestone | Purpose |
| --- | --- |
| Presence & Re-list | Landing, changelog, `/presence` SLA, social proof, weight evidence |
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
| `pr-jagtensor-policy.yml` | jagtensor gates: linked issue, UI scope, screenshots, size, protected paths, ≤5 open PRs |
| `jagtensor-commands.yml` | Maintainer-only `@jagtensor /review` (and `/help`) on PR comments |
| `build.yml` | Lint / typecheck / build |

Bot identity: see [docs/bots.md](./bots.md). Policy comments speak as **jagtensor[bot]** once `JAGTENSOR_APP_*` secrets are set.

## Linked-issue gate

Score-eligible PRs must point at a **currently open** issue. jagtensor enforces this on every PR (`missing-linked-issue` / `linked-issue-not-open`).

### Required

1. Pick an open [`gittensor-hub:wanted`](https://github.com/e35mongo/gittensor-hub/labels/gittensor-hub%3Awanted) / [`help wanted`](https://github.com/e35mongo/gittensor-hub/labels/help%20wanted) issue (or another accepted score path).
2. In the PR body (and ideally the title), link it: `Closes #123` or at least `#123`.
3. Keep ≤ **5** open PRs per author — close or merge before opening more.

### Good vs slop

| Good | Slop / will be flagged |
| --- | --- |
| `Closes #266` — implements the wanted `/my-work` shell only | No `#N` at all |
| Links an **open** wanted issue; diff matches that slice | Links a **closed** or unrelated epic |
| One PR per wanted child issue | Drive-by README / typo farm with no issue |
| Screenshot in body when UI changes | UI on a backend/docs-only issue |

Full bot codes: [docs/bots.md](./bots.md). Contributor rules: [CONTRIBUTING.md](../CONTRIBUTING.md).

## Wanted buffer

Curated seeds live in [`.github/wanted-backlog.json`](../.github/wanted-backlog.json). Maintainers edit that file; the weekly workflow opens missing issues labeled `gittensor-hub:wanted` + `help wanted`.
