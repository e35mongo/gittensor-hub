# PR labels (gittensor-hub)

Detailed `pr:*` labels for triage. jagtensor applies/clears the **auto** ones on each policy run.

## Policy findings (auto)

| Label | When |
| --- | --- |
| `pr:missing-issue` | No `#N` / `Closes #N` |
| `pr:issue-closed` | Linked issue not open |
| `pr:ui-scope` | Unrelated / out-of-scope UI |
| `pr:needs-screenshot` | UI without visual proof |
| `pr:needs-frontend-label` | Wanted issue missing `frontend` for UI work |
| `pr:protected-paths` | Workflows / scripts / lockfiles / Next config |
| `pr:oversized` | Above size hold threshold |
| `pr:large` | Above size warn threshold |
| `pr:too-many-open` | Author > 5 open PRs |
| `pr:needs-tests` | `src/` changed, no tests in diff |
| `pr:needs-work` | Any jagtensor finding still open |
| `pr:flagged` | Any **major** finding |
| `manual-review` | Same as flagged (human hold) |

## Size (auto — exactly one)

| Label | Threshold |
| --- | --- |
| `pr:size/xs` | ≤2 files, ≤50 lines |
| `pr:size/s` | ≤8 files, ≤200 lines |
| `pr:size/m` | ≤25 files, ≤600 lines |
| `pr:size/l` | ≤45 files, ≤1200 lines |
| `pr:size/xl` | Above L |

## Surface (auto)

| Label | Meaning |
| --- | --- |
| `pr:ui` | Components / pages / styles |
| `pr:api` | `src/app/api` / server |
| `pr:ci` | Actions / workflows |
| `pr:deps` | package / lockfile |
| `pr:docs-only` | Docs-only diff |

## Role (auto)

| Label | Meaning |
| --- | --- |
| `pr:maintainer` | Author is OWNER / MEMBER / COLLABORATOR |
| `pr:maintainer-only` | Linked issue is `maintainer-only` or `roadmap` (not score-eligible) |

## Review lifecycle (manual)

| Label | Meaning |
| --- | --- |
| `pr:ready` | Author ready for review |
| `pr:changes-requested` | Maintainer requested changes |
| `pr:approved` | Approved pre-merge |
| `pr:do-not-merge` | Hard block |
| `pr:verified` | Passed quality/security (existing) |

## Scoring (issues + PRs)

Unchanged: `gittensor:bug` / `gittensor:feature` / `gittensor:priority` / `slop` / `gittensor-hub:wanted` — see [CONTRIBUTING.md](../CONTRIBUTING.md).
