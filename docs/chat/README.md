# Chat retrieval API

Public extractive Q&A over [`docs/chat/`](./) (no LLM for MVP).

## Endpoint

`POST /api/public/chat`

Already allowlisted via `/api/public/` (no session).

### Request

```json
{ "question": "How does emission_share work?" }
```

### Response

```json
{
  "ok": true,
  "answer": "From “How SN74 emissions split…” …",
  "citations": [{ "id": "emissions-split", "path": "docs/chat/01-emissions-split.md", "title": "…" }],
  "refused": false,
  "disclaimer": "Answers are retrieved from the Hub knowledge pack only. …"
}
```

If nothing relevant: `refused: true`, empty `citations`, clear refusal text. Still includes `disclaimer`.

## Rules

- Answers are **only** from retrieved knowledge-pack chunks.
- Do not invent emission numbers; pack text already caveats per-repo overrides.
- Chat UI (#271): floating FAB + docked bottom-right panel (no backdrop) on every page via root layout; calls this API (not a `/chat` page).
