## Gittensor Hub Contributor Guide

### Getting Started

1. Read the [README](./README.md)
2. Stack: **Next.js 16**, React 19, TypeScript, Primer React, SQLite (`better-sqlite3`)
3. Check [wanted issues](https://github.com/MkDev11/gittensor-hub/issues?q=is%3Aissue+is%3Aopen+label%3Agittensor-hub%3Awanted) before inventing work
4. Read [docs/github-os.md](./docs/github-os.md) for labels, milestones, and issue views

### Local Development

1. Node 20.19+ (or 22.13+ / 24+) and [pnpm](https://pnpm.io/)
2. `pnpm install`
3. Copy `.env.local.example` → `.env.local` (see README for OAuth + PATs)
4. Optional: `./scripts/seed-db.sh` for a sanitized cache snapshot
5. `pnpm dev` → `http://localhost:12075` (dev worktree default; prod often `12074`)

> **Never connect local to the production database.**

### Where to start (anti-slop)

Most low-value PRs are agent-generated without deep thinking. We only want work that compounds the product.

**Do this:**

* Pick an open [`gittensor-hub:wanted`](https://github.com/MkDev11/gittensor-hub/labels/gittensor-hub%3Awanted) or [`help wanted`](https://github.com/MkDev11/gittensor-hub/labels/help%20wanted) issue
* Or [`good first issue`](https://github.com/MkDev11/gittensor-hub/labels/good%20first%20issue)
* Link that **currently-open** issue from your PR (`Closes #N`)

**Do not do this:**

* Unsolicited AI refactors, typo farms, or “improve README” spam → labeled `slop`, score **0**, usually closed
* Work labeled [`maintainer-only`](https://github.com/MkDev11/gittensor-hub/labels/maintainer-only) — **no** miner / Hub Score points
* Opening a 3rd concurrent PR (max **5** open PRs per author)
* Plagiarism or alt/sockpuppet farming → `banned`

### Creating Issues

Blank issues are **disabled**. Use a form:

* **Bug Report** — reproduction + proof required (`gittensor:bug` path)
* **Feature Request** — design note required; may become `gittensor-hub:wanted` or `maintainer-only`
* **Claim wanted work** — only if you need a new wanted-scoped tracker

Security: use [Security Advisories](https://github.com/MkDev11/gittensor-hub/security/advisories/new) — see [SECURITY.md](./SECURITY.md).

### Labels that matter for scoring

| Label | Meaning |
| --- | --- |
| `gittensor-hub:wanted` | Maintainer-requested — high-score eligible gate |
| `gittensor:bug` | Bug fix path (when accepted / merged with policy) |
| `gittensor:feature` | Feature path tied to a real issue |
| `gittensor:priority` | Maintainer-only grant for outstanding work |
| `slop` | Zero score |
| `maintainer-only` | Owner work — zero miner score |
| `help wanted` / `good first issue` | Community-takeable |

When this repo is Gittensor-listed, validator `label_multipliers` should mirror these names. **A merge is not a promise of TAO.**

### Pull requests

1. Branch from `main`, PR into `main`
2. Fill the PR template — linked open issue is required for score-eligible work
3. Keep the diff focused
4. Ensure `pnpm run lint` and `pnpm build` pass

#### Review norms

* Prefer **merge-as-is or close with reason** for drive-by / off-scope PRs (open a fresh corrected PR)
* Do not DM or spam @mentions to chase review — it slows you down
* Address requested changes with new commits on the same branch
* **Unrelated UI work** (changing pages/components/styles on a backend/docs-only issue, or UI with no linked `frontend` wanted issue) is flagged by **jagtensor** (`pr:flagged`) and may be closed as `slop`
* User-visible UI PRs must include a screenshot or before/after in the PR body
* jagtensor also flags missing linked issues, oversized PRs, protected-path edits (workflows / `scripts/*` / lockfiles / config), and >5 open PRs per author — see [docs/bots.md](./docs/bots.md)

### Code Standards

* Follow existing patterns; no drive-by dependency adds
* Meaningful changes > cosmetic churn
* `pnpm build` must pass

### Weekly changelog (maintainers)

Public ship notes: [`/changelog`](https://github.com/e35mongo/gittensor-hub/blob/main/docs/changelog.md). Add a markdown file under `content/changelog/` — see [docs/changelog.md](./docs/changelog.md).

### Branches

#### `main`

Production dashboard. PR required; CI must pass; maintainer approval required.

### License

Contributions are licensed under the project license (MIT).

---

Thank you for helping build Gittensor Hub without the slop.
