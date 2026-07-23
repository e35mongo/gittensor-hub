# Bots on gittensor-hub

| Layer | Identity | Job |
| --- | --- | --- |
| **jagtensor** (our GitHub App) | `jagtensor[bot]` | Hub policy Actions: linked issue, UI scope, size, protected paths, concurrent PR limit, wanted-buffer |

jagtensor is the speaker + deterministic policy we own for this repo.

## 1) jagtensor GitHub App (one-time)

1. Create App named **`jagtensor`** (webhook **inactive**), or keep your existing `jagtensor` App.
2. Permissions: Pull requests R/W, Issues R/W, Contents Read, Metadata Read.
3. Install on `e35mongo/gittensor-hub`.
4. Repo secrets (preferred): `JAGTENSOR_APP_ID`, `JAGTENSOR_APP_PRIVATE_KEY`.  
   Legacy `JAGUAR_APP_*` still works until you rename them.

Until secrets exist, workflows fall back to `github-actions[bot]`.

## 2) jagtensor policy checks

Workflow: `pr-jagtensor-policy.yml` → `scripts/pr-jagtensor-policy.mjs`  
One sticky PR comment (`<!-- gittensor-hub:jagtensor-policy -->`).

| Code | Severity | Meaning |
| --- | --- | --- |
| `missing-linked-issue` / `linked-issue-not-open` | major | Need open `#N` / `Closes #N` |
| `ui-without-issue` / `ui-outside-issue-scope` / `ui-on-maintainer-epic` / `ui-mixed-into-backend-pr` | major | Unrelated or unsourced UI |
| `ui-missing-screenshot` | major/minor | User-visible UI needs proof |
| `protected-paths` | major | Workflows / `scripts/*` / lockfiles / Next config without write access |
| `oversized-pr` | major | Too many files/lines → `manual-review` |
| `large-pr` | minor | Getting large — prefer slices |
| `too-many-open-prs` | major | Author over the ≤5 open PR limit |
| `src-without-tests` | minor | Src changed, no tests in diff |
| `ui-wanted-missing-frontend-label` | minor | Wanted issue missing `frontend` label → `pr:needs-frontend-label` |

Majors add `pr:flagged` + `manual-review` plus granular labels (`pr:missing-issue`, `pr:ui-scope`, …). Full table: [docs/pr-labels.md](./pr-labels.md).

Also: `wanted-buffer.yml` weekly tops up `gittensor-hub:wanted` issues.

## 3) Maintainer slash commands

Workflow: `jagtensor-commands.yml` → `scripts/jagtensor-commands.mjs`  
Triggers on PR comments only. **Maintainer-only** (`OWNER` / `MEMBER` / `COLLABORATOR`). Everyone else who tries gets a short denial — no policy re-run.

| Command | Effect |
| --- | --- |
| `@jagtensor /review` (or `/policy`) | Re-run policy sticky comment + labels |
| `@jagtensor /help` | List commands |

Examples:

```text
@jagtensor /review
```

Policy still runs automatically on every PR `opened` / `synchronize` — slash commands are for on-demand maintainer re-checks.

## 4) Verify

1. PR without `#N` → jagtensor sticky comment with `missing-linked-issue`.
2. UI on a backend-only wanted issue → `ui-outside-issue-scope`.
3. Job summary shows `Identity: jagtensor` when secrets + install are set.
4. Maintainer comments `@jagtensor /review` → policy re-runs; a non-maintainer gets a denial reply.
