# Website audit and optimization - October 22, 2026

Scope: local production build of the dinnerware selector, catalog, plating
studio, and workspace. Existing uncommitted food-provider work was retained.
Original catalog photographs and 3D assets were preserved. These changes have
not been deployed.

## Problems addressed

| Area                   | Observed problem                                                                                                                                                        | Result                                                                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login redirects        | A return path containing backslashes could be interpreted as an external host.                                                                                          | Return paths reject external authorities, backslashes, and control characters; local recovery links continue to work.                                                                                              |
| Saved scenes           | A delayed saved-scene or collection response could restore an old rotation after the user reset placement. The baseline phone test failed with 45 degrees instead of 0. | Revision and selection checks preserve newer edits. Separate delayed-response tests cover both stages.                                                                                                             |
| Browser storage        | Failed localStorage writes could interrupt editing, authentication prompts, or uploads. Malformed stored values could become non-string form fields.                    | Optional storage uses guarded access. Briefs accept only known string fields with length limits. The selector continues working and explains when persistence is unavailable.                                      |
| Catalog failures       | Search errors were silent, unsuccessful responses were treated as results, and collection dialogs offered no retry.                                                     | Search and detail requests check responses, ignore cancelled work, show useful errors, and provide explicit retry controls. Empty searches reuse the supplied catalog without a redundant request.                 |
| Request validation     | Malformed JSON and invalid Origin headers could become service errors; the original Origin check compared only hosts.                                                   | JSON endpoints return 400 for invalid objects. Invalid, opaque, cross-host, and cross-protocol browser origins return 403, while the public Host works with Next.js internal URLs. Unknown collections return 404. |
| Accessibility          | Pale text failed contrast checks; a photo input lacked a name; several accessible names omitted visible control text.                                                   | Muted colors are readable on the existing surfaces. Input and button names match their controls, including the 3D viewer.                                                                                          |
| Dialogs and navigation | Authentication dialogs allowed background scrolling; navigation lacked current-page semantics and mobile Escape handling.                                               | Dialogs lock scrolling and return focus. Navigation exposes the current page and supports Escape. Catalog pagination honors reduced motion.                                                                        |
| Failure recovery       | Unhandled rendering errors and missing pages used framework defaults. Missing account configuration could also break public catalog access.                             | Branded 404 and error boundaries provide recovery paths. The seed catalog remains usable without account configuration.                                                                                            |
| Privacy and crawling   | Private JSON responses lacked explicit no-store headers; workspace pages lacked indexing restrictions; sitemap and robots routes were absent.                           | API/auth responses are private and no-store. Private workspace pages are noindex. Public routes have canonical URLs, robots.txt, and a sitemap.                                                                    |
| Static asset overhead  | Cards loaded large hero photographs, the header used a 128 KB PNG, and authenticated proxy work could run for model/worker assets.                                      | Builds generate smaller catalog previews and a WebP logo. Original detail images remain available. Model and worker assets bypass session-refresh work.                                                            |

## Performance observations

The same audit visits the four routes in order using separate desktop and
phone browser contexts. These are local resource-transfer measurements,
including normal browser caching and prefetching. They are not production
Core Web Vitals or guaranteed loading times.

| Browser / page  | Baseline transfer | After optimization | Approximate reduction |
| --------------- | ----------------: | -----------------: | --------------------: |
| Desktop home    |   1,352,203 bytes |      959,836 bytes |                   29% |
| Desktop catalog |   1,870,566 bytes |      912,296 bytes |                   51% |
| Phone home      |   1,033,664 bytes |      675,228 bytes |                   35% |
| Phone catalog   |     925,227 bytes |      499,357 bytes |                   46% |

All 83 collection thumbnails together occupy approximately 4,268 KB, compared
with 9,838 KB for their original hero sources. Thumbnail generation runs in
`predev` and `prebuild`; generated previews are ignored by Git and reproducible.
The catalog source files are unchanged.

## Dependency security follow-up

Following authorization to send dependency metadata to npm's official audit
endpoint, the complete audit identified two underlying advisories propagated
through eight package entries. The targeted dependency change reduced this
to five high-severity development entries and zero moderate entries.
`npm audit --omit=dev` completed successfully with zero reported vulnerabilities.
This is a dependency database result, not a guarantee that the application has
no security flaws.

| Dependency chain                                                                            | Finding                                                                                       | Resolution                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mammoth -> argparse 1.0.10 -> sprintf-js 1.0.3`                                            | Three moderate entries originating from an unbounded numeric precision issue in `sprintf-js`. | Override only Mammoth's `argparse` to `2.0.1`, which retains compatibility aliases for Mammoth's old CLI API and does not depend on `sprintf-js`. The old nested parser and formatter are removed from the lockfile.                                                        |
| `eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces 3.0.3` | Five high entries originating from uncontrolled recursion on deeply nested brace patterns.    | Remains a development dependency finding. Upstream has no patched release as of this check. The current ESLint configuration does not define `settings.next.rootDir`, which is the plugin's entry to the affected glob processing; no website request path to it was found. |

The official advisories list no patched versions for
[braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) or
[sprintf-js](https://github.com/advisories/GHSA-hp3w-g68c-fv3c).
Registry metadata also confirms that the available Next.js ESLint patch
`16.4.2` still depends on `fast-glob 3.3.1`, so that update does not remove
the remaining chain. The audit's suggested forced downgrades to
`eslint-config-next 14.2.35` and `mammoth 0.3.29` were not applied.

Mammoth's CLI help and HTML/Markdown conversion of the existing DOCX fixture
passed after the override, with conversion output matching the baseline. Its
old API names produce argparse deprecation warnings in the CLI. The website
uses the document library directly and does not invoke that CLI. Revisit the
override when Mammoth updates its parser; the five development findings remain
open pending an upstream fix.

After this dependency change, all 143 unit tests, ESLint, and the Node 24
production build with TypeScript passed again. Server-side raw DOCX extraction
returned the expected fixture text with no warnings. The existing desktop and
phone browser tests for local PDF, DOCX, and image menus both passed, including
their checks that no account upload or AI job requests were made. All 28
generated production file-trace manifests were inspected; none referenced the
affected formatter or the five packages in the ESLint advisory chain.

Machine-readable audit snapshots are saved under `.cache/site-audit/` as
`dependencies-before.json`, `dependencies-after.json`, and
`dependencies-production.json`.

## Verification

- Node 24 production build and TypeScript compilation passed.
- ESLint passed.
- 143 unit tests passed.
- The complete desktop/phone browser suite passed all 112 checks after the
  behavioral fixes.
- After the final text and accessible-name adjustments, all 20 focused
  resilience and UI regression checks passed serially on desktop and phone
  in 44.1 seconds.
- Catalog verification passed: 83 collections, 3,133 verified records,
  184 product pages, and 3,505 original catalog assets. The 26 printed source
  ambiguities remain visible.
- Public API smoke checks passed for assets, strict recommendations, source
  notes, and anonymous access protection. The observed local recommendation
  request times were 33, 16, and 14 milliseconds.
- The final production build passed the expanded audit across 21 states
  (10 desktop and 11 phone): all returned HTTP 200, with zero automated
  accessibility violations, broken images, horizontal overflow, or unhandled
  browser errors. The audit covers four public routes, the expert form,
  recommendations, sign-in and collection dialogs, mobile navigation, and
  rendered 3D controls in both default and active states.
- The final expanded audit used `--no-screenshots` after screenshot-heavy
  checks timed out. Its completed, checkpointed report is stored at
  `.cache/site-audit/final-accessibility/report.json`. Earlier screenshots
  remain available under `.cache/site-audit/interactive/`.

## Repeating the checks

Use Node 24. Run `npm run build`, then start the production server with
`npm run start -- --hostname 127.0.0.1 --port 4173`.

In another terminal:

```sh
npm run test
npm run lint
npm run typecheck
npm run catalog:check
npm run test:e2e
npm run audit:ui -- latest --interactive
```

The UI audit writes JSON reports, full-page screenshots, and viewport
screenshots under `.cache/site-audit/<label>/`. `AUDIT_SITE_URL` can select a
different explicitly approved test origin. `LIVE_SITE_URL` controls the existing
public API smoke script. Add `--no-screenshots` to run the DOM and accessibility
checks without screenshot capture when the execution environment has limited
resources. Reports are checkpointed after each completed state.

## Remaining verification limits

- The application changes are local and have not been pushed or deployed.
- Phone tests emulate an iPhone viewport in Chromium. They do not establish
  compatibility with physical iPhones, Safari, or Firefox.
- Browser account/workspace tests use mocked account and API responses.
  Real Supabase policy tests, email delivery, and paid AI generation were not
  invoked during this audit.
- A final supplemental 3D screenshot rerun timed out, including on a serial
  retry. A read-only system snapshot showed approximately 887 MB of physical
  memory available. The earlier complete 112-test run passed before the final
  text/accessible-name adjustments; the later screenshot timeout is recorded
  as an execution limitation rather than treated as a passing result.
- Five high-severity development dependency entries remain from the unpatched
  `braces` advisory described in the dependency follow-up. The authorized
  production dependency audit reports zero vulnerabilities after the fix.
- Automated accessibility checks cover the exercised states and do not replace
  manual assistive-technology testing or establish complete WCAG conformance.
