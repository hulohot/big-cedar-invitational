# Convex Live Scoring Rollout

Live scoring is now Convex-only in `scorer.html`.

## Runtime Config Contract

Runtime config is loaded from [`scoring-config.js`](../scoring-config.js).

```js
window.BCI_SCORING_CONFIG = {
  convexUrl: "https://<deployment>.convex.cloud",
  convexModuleUrl: "https://esm.sh/convex@1.28.0/browser",
  functions: {
    getLeaderboard: "scoring:getLeaderboard",
    submitScorecard: "scoring:submitScorecard",
  },
};
```

Override rules in `scorer.html` (highest to lowest):

1. URL query (`?convexUrl=...` and optional `?convexModuleUrl=...`)
2. `window.BCI_SCORING_CONFIG`
3. built-in defaults in page script

## Deployment Notes

- GitHub Pages: commit `scoring-config.js` with the target `convexUrl`.
- Vercel/static hosting: deploy the same assets; Convex remains the live-scoring backend.

## Convex Setup

1. Install root dependencies:
   `npm install`
2. Initialize Convex project for this repo:
   `npx convex dev`
3. Keep the generated Convex deployment value in your local Convex config.
4. Set `convexUrl` in `scoring-config.js` for the target environment.

## Local Testing

1. In one terminal, start Convex dev and keep it running:
   `npm run convex:dev`
2. Set the local dev deployment URL in `scoring-config.js` (or pass `?convexUrl=...` in the page URL).
3. In another terminal, serve the repo as static files:
   `python3 -m http.server 8082`
4. Open `http://localhost:8082/scorer.html` in two browsers/devices.
5. Submit scores in browser A and verify browser B updates in near realtime.
6. Repeat with a 9-hole card and an 18-hole card, and confirm ordering:
   `toPar ASC`, `holesPlayed DESC`, `playerName ASC`.

## Rollback

- Roll back by redeploying a prior frontend commit.
- If needed, temporarily point `convexUrl` to a known-good Convex deployment.

## Acceptance Checklist

- 9-hole and 18-hole submissions calculate `toPar` correctly.
- Leaderboard ordering remains: `toPar ASC`, `holesPlayed DESC`, `playerName ASC`.
- Latest submission per player is shown.
- Realtime updates are visible on a second browser/device within a few seconds.
