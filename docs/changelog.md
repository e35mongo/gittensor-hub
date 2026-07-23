# Changelog (maintainer guide)

Public weekly ship notes live at **`/changelog`**.

## Cadence

- Publish **one entry per week** during P0a presence proof (and keep going after).
- Prefer Monday UTC (or the day you actually ship the week’s summary).
- No filler: skip a week only if literally nothing merged — then say so in one short entry.

## Add a note

1. Create a markdown file under [`content/changelog/`](../content/changelog/):

   ```text
   content/changelog/YYYY-MM-DD-short-slug.md
   ```

2. Use this frontmatter + body shape:

   ```markdown
   ---
   date: 2026-07-28
   title: Short factual headline
   ---

   One or two sentences of context.

   ### Shipped

   - **Thing** — what changed ([#123](https://github.com/e35mongo/gittensor-hub/pull/123))

   ### Operating note

   Optional: presence / chat / wanted-board reminder.
   ```

3. Open a PR that only adds the note (or pairs it with related docs). Link the weekly ops issue if you have one.

## Rules

- `date` must be `YYYY-MM-DD` (ISO). The page sorts newest first.
- `title` is required. Body markdown is rendered with the shared sanitizer.
- Link merged PRs/issues. Do not invent metrics.
- Keep tone plain — ship log, not marketing essay.

## Local check

```bash
pnpm dev
# open http://localhost:12075/changelog
```

The route is already on the public + chromeless allowlists in [`src/lib/marketing-routes.ts`](../src/lib/marketing-routes.ts).
