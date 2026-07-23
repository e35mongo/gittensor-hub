# How to mine on Gittensor (high level)

This is an orientation, not a substitute for the live miner guide. Commands and netuids can change — verify on https://docs.gittensor.io/miner.html before running anything.

## What you need

1. A **Bittensor wallet + hotkey** registered on SN74 (mainnet netuid **74** in current docs).
2. A **GitHub account** and a **fine-grained PAT** with public-repo read access (as documented by Gittensor).
3. Willingness to open **quality PRs** on **incentivized** (listed) repositories — only merged, validated work earns OSS score.

## Typical flow

1. Register the hotkey on the subnet (see current `btcli` / docs for mainnet vs testnet).
2. Create the GitHub fine-grained PAT per Gittensor miner docs.
3. Broadcast the PAT to validators, e.g. (mainnet shape from current docs):

   ```bash
   gitt miner post --pat <YOUR_PAT> --wallet <WALLET_NAME> --hotkey <HOTKEY_NAME> --netuid 74
   ```

4. Pick listed repos (live registry), open focused PRs, get them **merged**.
5. Optionally check that validators stored your PAT (`gitt miner check` in current CLI docs).

## Important constraints (current docs)

- Your **GitHub identity is pinned** to the hotkey on first PAT broadcast. Switching GitHub accounts requires deregister + re-register with a new hotkey.
- Duplicate GitHub accounts across miners are zeroed.
- Eligibility, lookbacks, multipliers, and spam thresholds are **per repo** and often overridable — do not assume global defaults.
- Maintainers (`OWNER` / `MEMBER` / `COLLABORATOR`) do not earn on the PR / issue-discovery path for repos they maintain.

## Where Hub helps

Use Gittensor Hub to browse listed repos, issues, PRs, and modeled reward context. Hub does **not** replace validators or invent emission figures.

## Sources

- https://docs.gittensor.io/miner.html
- https://docs.gittensor.io/cli.html
- https://docs.gittensor.io/oss-contributions.html
- Live registry: https://github.com/entrius/gittensor/blob/main/gittensor/validator/weights/master_repositories.json
