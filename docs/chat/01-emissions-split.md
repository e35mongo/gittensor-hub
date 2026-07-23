# How SN74 emissions split (OSS pool)

Per-repo configs **vary**. Treat numbers below as **documented defaults / structure**, not universal constants. Always check the live repo entry in `master_repositories.json` and [Repository Hyperparameters](https://docs.gittensor.io/repository-hyperparameters).

## Top-level split (documented)

- **OSS pool (90%)** — distributed by each repo’s `emission_share`
- **Issues treasury (10%)** — flat allocation to the smart-contract neuron (UID 111 in current docs)
- **Recycle** — registry slack (`1 - sum(emission_share)`) and empty repo slices recycle (UID 0 in current docs)

## Per-repo slice

```
repo_slice = emission_share × 0.90
```

Then, after optional **maintainer_cut** (see below):

```
pr_slice    = remaining_slice × (1.0 − issue_discovery_share)
issue_slice = remaining_slice × issue_discovery_share
```

- PR pool is filled by miners’ `earned_score` on that repo (normalized within the pool).
- Issue-discovery pool is filled by `discovery_earned_score` on that repo.
- **Spill-over:** if exactly one of the two pools is empty in a repo, that empty side transfers to the non-empty side **inside the same repo**. If both empty, the repo slice recycles.

## emission_share

- Float in `[0, 1]`; across listed repos must sum to `≤ 1.0`.
- A repo with eligible nonzero-scored activity in the lookback receives its slice for that round — it does **not** steal another repo’s share by shipping more PRs.
- `emission_share` is **not** a per-PR multiplier; it bounds the repo’s pool, then scores compete **inside** that pool.

## maintainer_cut

- Fraction of the repo slice routed to **maintainer miner neurons**, carved off **before** the PR / issue-discovery split.
- Applies only when registered maintainer miners exist for that repo (GitHub `OWNER` / `MEMBER` / `COLLABORATOR` association).
- If none are registered, **no carve-out** — the full slice scores normally.
- Maintainers are barred from PR-side and issue-discovery rewards on repos they maintain; the carve-out is their earning path there.

## Hub UI note

Gittensor Hub’s dashboard mirrors this allocator at UI level for explanation cards. Prefer live Gittensor docs + registry if Hub UI and docs ever disagree.

## Sources

- https://docs.gittensor.io/oss-contributions.html (Emission Allocation)
- https://docs.gittensor.io/repository-hyperparameters
- Hub README / `/docs` allocator summary
