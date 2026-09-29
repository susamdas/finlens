# FinLens — Testing & Deployment

FinLens is a static single-page app. The production build (`dist/`) is plain HTML, JS, CSS and
JSON, so it can be hosted on any static host or behind nginx. There is no server, database or
API key; the AI Analyst runs in the browser.

## 1. Before you deploy

```bash
npm install
npm run check          # data:verify → lint → typecheck → unit tests → production build
npm run test:e2e:install   # first time only: downloads Chromium for Playwright
npm run test:e2e       # builds, serves with production headers, runs all browser tests
```

`npm run check` must pass before every release. CI runs the same steps (section 4).

### Updating the Findex data

1. Put the new workbook in `public/data/raw/` (it is git-ignored and never deployed).
2. `npm run data:build` rewrites `public/data/processed/`.
3. `npm run data:verify` and `npm test` — the golden tests compare published values
   (e.g. Bangladesh account ownership 2024 = 43.28 %). If the World Bank revises a value, check
   it against the workbook and only then update the test.
4. Commit `public/data/processed/`. Browsers pick up the new files automatically, because every
   data URL carries the build time (`?v=<builtAt>`) and `meta.json` is never cached.

## 2. What is tested

| Layer         | Tool                                              | What it covers                                                                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data          | `npm run data:verify` (`scripts/verify-data.mjs`) | Schema version, unique ids, valid region/income/aggregate references, every indicator has a data file, every row is a known economy × wave × group, no duplicate rows, every value a finite percentage in [0, 100]. Needs only the processed JSON, so it runs in CI                          |
| Logic         | Vitest (`tests/unit`, 23 files)                   | Pipeline rules, repository, statistics, forecasting, insight and analyst engines, every page's `*.logic.ts`, export formats; golden values checked against the source workbook. Coverage thresholds: `src/lib` and `*.logic.ts` ≥ 85 % of lines, `src/data` ≥ 75 % (`npm run test:coverage`) |
| Pages         | Playwright `pages.spec.ts`                        | All 23 pages on desktop (1280 px) and mobile (Pixel 7): heading renders, no console or page errors, no failed requests, no sideways scrolling; 404 page; unknown slugs                                                                                                                       |
| Journeys      | Playwright `flows.spec.ts`                        | Search → profile, published values on screen, comparison URL state, AI Analyst answer with sources, Data Explorer CSV (full precision + citation), deep links, dark mode persistence, mobile menu, PNG export under the production security policy                                           |
| Accessibility | Playwright + axe-core `a11y.spec.ts`              | WCAG 2.1 A/AA rules on every page, light and dark themes; serious or critical violations fail the build                                                                                                                                                                                      |

Automated accessibility checks find only part of the issues. Before a major release, also
check key pages with a keyboard only and with a screen reader (NVDA on Windows, VoiceOver on
macOS/iOS or TalkBack on Android).

To test a deployed site instead of a local build:

```bash
E2E_BASE_URL=https://your-finlens-address E2E_EXPECT_HEADERS=1 npm run test:e2e
```

## 3. Hosting options

All options serve the same `dist/` folder with the same headers:

| Header                                                                                                             | Value / purpose                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`                                                                                          | Only FinLens' own scripts, data and fonts; no inline scripts; no framing                                                                                                            |
| `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` | Standard hardening; camera, microphone, location and payments disabled                                                                                                              |
| Caching                                                                                                            | `/assets/*` 1 year, immutable (hashed names) · `/data/*` 1 day + revalidate (versioned URLs) · `meta.json`, `index.html`, `theme-init.js` always revalidated · map and flags 1 week |

The single source for headers is `public/_headers`. `vercel.json` and
`deploy/finlens-security.conf` repeat them for hosts that do not read that file, and
`vite preview` loads them from it so the browser tests run under the real policy. **Keep all
three in sync.** If you later switch the data source to an external API
(`VITE_DATA_SOURCE=api`), add that API's address to `connect-src`.

### A. Netlify

1. Push the repository to GitHub (with `public/data/processed/` committed).
2. Netlify → _Add new site_ → _Import an existing project_ → select the repository.
3. The settings come from `netlify.toml` (build `npm run data:verify && npm run build`,
   publish `dist`, Node 22). Headers come from `public/_headers`, SPA routing from
   `public/_redirects`.

### B. Vercel

1. Vercel → _Add New Project_ → import the repository.
2. `vercel.json` sets the build, output, SPA rewrites and headers. No environment variables
   are needed.

### C. Cloudflare Pages

Build command `npm run data:verify && npm run build`, output directory `dist`, environment
variable `NODE_VERSION=22`. Cloudflare Pages reads `public/_headers` and `public/_redirects`.

### D. Self-hosted (Docker + nginx)

```bash
docker build -t finlens .
docker run --rm -p 8080:8080 finlens     # http://localhost:8080
```

The image builds the app, then serves it with unprivileged nginx on port 8080 using
`deploy/nginx.conf` (gzip, caching, SPA fallback, 404 for missing assets) and
`deploy/finlens-security.conf`. Put it behind your usual HTTPS reverse proxy or load balancer.
Without Docker, copy `dist/` to any nginx server and use those two files.

### Base path

The app is built for the site root (`/`). To host it under a sub-path such as
`https://example.org/finlens/`, build with `npx tsc -b && npx vite build --base=/finlens/`.
Routing, data, map and flag URLs follow the base automatically (tested); adjust the host's
rewrite rule and header paths to the same prefix.

## 4. Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request:

1. **check** — `npm ci`, data verification, lint, type check, unit tests with coverage
   thresholds, production build, `npm audit` of production dependencies (fails on high or
   critical). Uploads `dist` and the coverage report.
2. **e2e** — installs Chromium, runs the full Playwright suite (desktop + mobile, including
   accessibility). Uploads the HTML report when something fails.

Connecting Netlify, Vercel or Cloudflare Pages to the same repository gives a preview address
for every pull request and deploys `main` automatically. Protect `main` so that the CI checks
must pass before a merge.

## 5. Release checklist

- [ ] `npm run check` and `npm run test:e2e` pass locally, and CI is green
- [ ] Data updated? `data:verify` passes and golden tests were checked against the workbook
- [ ] About page shows the right Findex edition, release date and citation
- [ ] Spot-check three economies against the World Bank Findex data portal
- [ ] After deploying: open a deep link (e.g. `/country/bangladesh`) and a missing page
      (`/does-not-exist`); confirm headers with `curl -I https://your-address/`
- [ ] Optional: `E2E_BASE_URL=… npm run test:e2e` against the live site

## 6. Known notes

- `npm audit` reports two moderate issues in `exceljs` → `uuid`. `exceljs` is only a
  development tool used by `npm run data:build` to read the workbook; it is not part of the
  deployed site (`npm audit --omit=dev` reports 0 vulnerabilities).
- Source maps are off by default (they add about 7 MB). Build with `SOURCEMAP=true npm run build`
  when you need to debug a production issue.
