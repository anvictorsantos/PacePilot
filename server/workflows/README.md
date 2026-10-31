# Render Workflows

Durable Strava history import. The web service starts `backfillHistory` after a
provider is linked; the workflow walks the retained window in bounded pages.

## Tasks

- `backfillHistory` — root task, max 30 minutes.
- `backfillPage` — up to `BACKFILL_PAGES_PER_STEP` provider pages, max 2 minutes,
  retried with exponential backoff.

The cursor remains the source of truth. Starting the workflow twice cannot
duplicate a page; the second run gets the stored progress instead.

## Trigger

```text
{WORKFLOW_SERVICE_SLUG}/backfillHistory
[athleteId, providerId]
```

The web service dispatches it only when `RENDER_API_KEY` and
`WORKFLOW_SERVICE_SLUG` are set. Otherwise the existing client-driven backfill
continues unchanged.

## Local

```bash
cd server
render workflows dev -- npm run workflows:start
```

The Render CLI provides the task socket. Outside it, `workflows:start` registers
the tasks and exits.
