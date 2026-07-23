# Bots on gittensor-hub

Hub uses **two layers** (same pattern as metagraphed):

| Layer | Identity | Job |
| --- | --- | --- |
| **LoopOver** (install/self-host) | `loopover-orb[bot]` / `loopover[bot]` | Deep PR review gate, AI + deterministic anti-slop, path policy via [`.loopover.yml`](../.loopover.yml) |
| **jaguar** (our GitHub App) | `jaguar[bot]` | Hub-specific Actions: linked-issue gate, UI-scope review, wanted-buffer |

You do **not** rebuild LoopOver as jaguar. jaguar is only the speaker + policy bots we own in Actions.

## 1) Create the jaguar GitHub App (you do this once)

1. GitHub → Settings → Developer settings → **GitHub Apps** → New GitHub App  
   - **Name:** `jaguar` (slug becomes the bot login `jaguar[bot]`)  
   - Homepage: your hub URL  
   - Webhook: inactive (Actions mint tokens; no webhook required for these bots)
2. Permissions (Repository):
   - **Pull requests:** Read & write  
   - **Issues:** Read & write  
   - **Contents:** Read  
   - **Metadata:** Read
3. Install the App on `e35mongo/gittensor-hub` (or `MkDev11/gittensor-hub` redirect).
4. Copy **App ID** + generate a **private key** (PEM).
5. Repo → Settings → Secrets and variables → Actions → add:
   - `JAGUAR_APP_ID`
   - `JAGUAR_APP_PRIVATE_KEY` (full PEM)

Until those secrets exist, workflows fall back to `github-actions[bot]` (current behavior).

## 2) Install LoopOver (deep review)

LoopOver’s shared hosted App is paused; **self-host** is the supported path:

- Docs: https://loopover.ai/docs/github-app  
- Self-host setup: https://loopover.ai/docs/maintainer-self-hosting  
- Engine/repo: https://github.com/JSONbored/loopover  

After Orb is installed on this repo:

1. Confirm [`.loopover.yml`](../.loopover.yml) is on `main`.
2. Keep gates **advisory** until health looks good, then tighten (`linkedIssue: block`, `slopGateMode`, etc.).
3. Optionally require check **LoopOver Orb Review Agent** in branch protection once blocking rules are intentional.

`.loopover.yml` already treats `src/**` / workflows as **blockedPaths** (no auto-merge of product code as “community data”) and notes UI/screenshot policy for reviewers.

## 3) What each jaguar Action does

| Workflow | Behavior |
| --- | --- |
| `pr-linked-issue.yml` | Warn if PR has no `#N` / `Closes #N` |
| `pr-ui-scope-review.yml` | Flag unrelated UI vs linked issue labels; `pr:flagged` + `manual-review` |
| `wanted-buffer.yml` | Weekly top-up of `gittensor-hub:wanted` issues |

All three call [`.github/actions/jaguar-token`](../.github/actions/jaguar-token/action.yml) so comments come from **jaguar** when secrets are set.

## 4) Verify

1. Open a tiny PR without an issue link → comment from `jaguar[bot]` (after secrets).  
2. Open a PR that adds a `src/components/*` file on a backend-only wanted issue → UI-scope major finding.  
3. With LoopOver installed, confirm the Orb check + sticky review panel on the same PR.
