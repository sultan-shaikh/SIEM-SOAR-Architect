# Sentinel Architect
Estimator for Microsoft Sentinel (SIEM) + SOAR consumption cost and managed-service design.

## Deploy
1. Push this folder to GitHub, connect the repo to Netlify (publish `public`, functions `netlify/functions` - set in netlify.toml).
2. Environment variables: `GEMINI_API_KEY`, `ACCESS_CODE`.
3. Open the site, enter the access code.

## Before quoting
- Rates are PLACEHOLDERS (GBP). Import your Microsoft/CSP rate card in Internal view > step 4 (CSV round-trips).
- Per-source log volumes are industry estimates blended with Microsoft's published allowances (E5 5MB/user/day, Defender for Servers P2 500MB/server/day, free sources). Calibrate with a Log Analytics Usage CSV in step 3.
- Customer view hides rate card, margins and internal assumptions; the PPTX is always customer-safe.

## Tests
`node tests/core.test.js`; `NODE_PATH=$(npm root -g) node tests/e2e.js` (Playwright, mock Gemini).
