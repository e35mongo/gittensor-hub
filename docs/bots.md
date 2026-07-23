# Bots on gittensor-hub

| Layer | Identity | Job |
| --- | --- | --- |
| **jaguar** (our GitHub App) | `jaguar[bot]` | Hub policy Actions: linked issue, UI scope, size, protected paths, concurrent PR limit, wanted-buffer |
| **LoopOver** (optional) | `loopover-orb[bot]` | Deep AI review — requires self-host; not required for jaguar |

jaguar is the speaker + deterministic policy we own. It is **not** a LoopOver clone.

## 1) jaguar GitHub App (one-time)

1. Create App named `jaguar` (webhook **inactive**).
2. Permissions: Pull requests R/W, Issues R/W, Contents Read, Metadata Read.
3. Install on `e35mongo/gittensor-hub`.
4. Repo secrets: `JAGUAR_APP_ID`, `JAGUAR_APP_PRIVATE_KEY`.

Until secrets exist, workflows fall back to `github-actions[bot]`.

## 2) jaguar policy checks

Workflow: `pr-jaguar-policy.yml` → `scripts/pr-jaguar-policy.mjs`  
One sticky PR comment (`<!-- gittensor-hub:jaguar-policy -->`).

| Code | Severity | Meaning |
| --- | --- | --- |
| `missing-linked-issue` / `linked-issue-not-open` | major | Need open `#N` / `Closes #N` |
| `ui-without-issue` / `ui-outside-issue-scope` / `ui-on-maintainer-epic` / `ui-mixed-into-backend-pr` | major | Unrelated or unsourced UI |
| `ui-missing-screenshot` | major/minor | User-visible UI needs proof |
| `protected-paths` | major | Workflows / lockfiles / Next config without write access |
| `oversized-pr` | major | Too many files/lines → `manual-review` |
| `large-pr` | minor | Getting large — prefer slices |
| `too-many-open-prs` | major | Author over the ≤2 open PR limit |
| `src-without-tests` | minor | Src changed, no tests in diff |
| `ui-wanted-missing-frontend-label` | minor | Wanted issue missing `frontend` label |

Majors add `pr:flagged` + `manual-review` plus granular labels (`pr:missing-issue`, `pr:ui-scope`, …). Full table: [docs/pr-labels.md](./pr-labels.md).

Also: `wanted-buffer.yml` weekly tops up `gittensor-hub:wanted` issues.

## 3) LoopOver (optional)

Shared hosted App is paused — self-host only. Config stub: [`.loopover.yml`](../.loopover.yml). Skip unless you want deep AI review.

## 4) Verify

1. PR without `#N` → jaguar sticky comment with `missing-linked-issue`.
2. UI on a backend-only wanted issue → `ui-outside-issue-scope`.
3. Job summary shows `Identity: jaguar` when secrets + install are set.
