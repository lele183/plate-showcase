# Yanco dinnerware showroom

Public Next.js website with deterministic recommendations, a searchable source-linked catalog, and a plating studio. Anonymous visitors can browse, read menus on their device, and save local starter scenes. Supabase accounts unlock hosted imports, cross-device saved projects, and food-photo uploads for manual placement.

Recommendations first enforce explicit product constraints, then score dish capabilities, editorial concept pairings, visual descriptors, actual matching item colors, and service needs. Dish terms are detected across all brief fields. Color-derived mood descriptors are separate from the small, versioned editorial lookup in `scripts/catalog-style-profiles.json`; colors never generate cuisine tags. Unsupported style metadata is not inferred from legacy tags. `scripts/catalog_style_profiles.py` refreshes only this metadata, and the full catalog builder calls the same helper after source corrections.

Cards feature a dish-appropriate matching SKU, including its size, name, and source photograph. The Italian preset features Legna LE-410, a verified 10¼″ Soup/Pasta Plate. Top concept matches, Signature options, and Value & high-durability options describe deterministic selection groups rather than sales popularity. The response separates `totalFilteredCount` from `meaningfulMatchCount` (positive style/menu relevance, excluding conflicting editorial pairings). `totalMatches` remains the eligible-filter count for API compatibility, and the group identifiers `Popular` / `Unique` / `Budget` remain stable for already-open clients; only their visible titles change. Explicit expert constraints are never relaxed to fill a group. Blank briefs show general catalog starting points; edited briefs mark results as stale until resubmitted.

Catalog filters and studio arrangements have shareable URLs. Collection details group matching product families under one photograph, with each size/SKU retaining its own specifications, preview, and source links. The close button stays outside the scrolling content; Escape closes the dialog and returns focus to its trigger.

Guest menus and up to 20 studio settings use `yanco_guest_workspace_v1` in this browser's local storage. Text, DOCX, and text-based PDF menus (first 40 pages, 20 MB) are read locally; images get a local preview with editable menu text. Scanned text extraction and larger hosted imports require sign-in. Drafts are not automatically uploaded on sign-in; open a local scene to save it to your account, or copy menu text into the account's menu panel. Shared studio links include starter layers and placement, without private image references.

## Development

Use Node **24**. Read the installed Next.js guides in `node_modules/next/dist/docs` before changing framework code.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:4173. Each private setting goes on its own `NAME=value` line in the ignored `.env.local` file, **without commas**.

`predev` and `prebuild` copy the installed PDF.js worker to a versioned public asset for local guest PDF reading. The generated worker is ignored by Git and lint; its version follows the lockfile.

These hooks also create 800-pixel collection thumbnails and a compressed header logo. Catalog cards use the smaller previews; detail pages and source links retain the original photographs. Generated assets are ignored by Git and recreated for development or production builds.

| Setting                                              | Value                                                                                                                                                     |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NEXT_PUBLIC_SUPABASE_URL                             | HTTPS project URL                                                                                                                                         |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY                 | Settings → API Keys → Publishable key (`sb_publishable_…`)                                                                                                |
| SUPABASE_SECRET_KEY                                  | Settings → API Keys → Secret key (`sb_secret_…`); server only. Legacy service-role JWT also works.                                                        |
| DATABASE_URL                                         | Connect → Connection string → URI (`postgresql://…`) with the database password. Use session pooler if direct IPv6 is unavailable. Local migrations only. |
| NEXT_PUBLIC_SITE_URL                                 | Public origin: https://plate-showcase.vercel.app                                                                                                          |
| AI_PREVIEW_PROVIDER                                  | Optional: `qwen` or `openai`. If unset, selects Qwen when a DashScope key is present, otherwise OpenAI.                                                   |
| DASHSCOPE_API_KEY / DASHSCOPE_REGION                 | Server-only Qwen key and its matching region: `singapore` (default), `beijing`, or `virginia`.                                                            |
| QWEN_IMAGE_MODEL                                     | Defaults to `qwen-image-2.1-turbo`; `qwen-image-2.1-pro` is also supported.                                                                               |
| OPENAI_API_KEY / OPENAI_IMAGE_MODEL                  | Optional OpenAI key; defaults to `gpt-image-1.5` for transparent food extraction. GPT Image 1, 1 mini, and 2 are also accepted.                           |
| AI_PREVIEW_DAILY_LIMIT / AI_PREVIEW_SITE_DAILY_LIMIT | Optional; defaults 5 per account / 50 per site per day.                                                                                                   |

Never put server keys or a database password in a `NEXT_PUBLIC_` variable. [Key guidance](https://supabase.com/docs/guides/getting-started/api-keys), [connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Food previews

AI food generation is paused by `src/lib/preview-policy.ts`. The studio disables generation, the jobs endpoint rejects new food-preview jobs before reserving quota, and the generation workflow step stops before calling a provider. Configuring a key does not override this pause. Existing food layers remain viewable.

Tabletop previews use a local 1400 x 1400 canvas shared with PNG export. Deterministic wood, linen, and stone surfaces, soft directional lighting, and separate contact shadows surround the original catalog cutout. Transparent image padding is excluded when sizing the piece; source pixels and colors are preserved. Starter food layers and uploaded photos can be moved, rotated, and scaled. Uploaded photos use a circular cover crop with adjustable zoom. Material and plate rendering is cached between placement changes. Image failures disable export and leave the controls available to choose another image. Illustrative 3D remains a separate renderer.

3,000 tabletop records across 80 collections use verified official product photographs, including 2,882 additional replacements after the first 118-photo release. These local transparent WebP assets have up to 1400 pixels on the long edge, with no upscaling or AI reconstruction. The LE-711 preview replaces a 400-pixel scan crop with a 1400-pixel cutout prepared from the official 2560 x 2150 photograph. Product source links, original dimensions, output dimensions, and SHA-256 hashes are recorded in `resources/studio-photo-sources.json`; five individually reviewed SKU aliases are documented in `resources/studio-photo-aliases.json`. The original catalog scans remain available for source review, and catalog rebuilds retain the higher-resolution studio selection. Browsing and exporting do not contact the manufacturer's site.

The retained provider integration supports Qwen and OpenAI if generation is deliberately re-enabled in a future change. It validates transparent output, preserves per-account/site quotas and upload caching, and never automatically retries or switches paid providers. Qwen configuration uses `AI_PREVIEW_PROVIDER=qwen`, `DASHSCOPE_API_KEY`, and the matching `DASHSCOPE_REGION`; an optional workspace-specific `DASHSCOPE_API_HOST` must be an official HTTPS origin. A configured provider without its own key remains unavailable even if another provider's key is present.

[Preview options and evaluation](docs/plating-preview-options.md) records pricing sources, the RTX 4070/12 GB deployment constraints, the research-only weights license, and the free online test. `node scripts/try-qwen-demo.mjs` makes one public Hugging Face text-to-image test without reading API keys; output and timings go under `.cache/qwen-evaluation`. It never falls back to a paid API. The demo is an evaluation service, not a production backend.

## Hosted setup

```sh
npm run db:migrate
npm run db:seed
node --env-file=.env.local scripts/test-hosted.mjs
```

If you prefer to keep the database password out of local configuration, run `supabase/setup.sql` once in the project's SQL Editor. This creates the same versioned schema in a transaction. Then run the seed and hosted test commands using the server Secret key.

Migrations create `yanco_` tables, owner-based row-level security, and public catalog/private customer buckets. Seeding uploads referenced assets, reconciles only the baseline catalog, verifies row counts, then activates it. The hosted test creates two temporary confirmed accounts, checks isolation and storage policies, and removes its fixtures.

After an editorial-only update, run `python scripts/catalog_style_profiles.py` and `node --env-file=.env.local scripts/sync-catalog-style.mjs` to update just the 83 published collections' style fields in a checked database transaction. Add `--check` to verify without writing. This leaves product specifications, uploads, and personal catalogs untouched.

In Supabase Authentication → URL Configuration, set the Site URL to the public origin. Allow `/auth/callback` and `/auth/confirm` on that origin, `/auth/callback` on the current preview origin, and `http://localhost:4173/auth/callback` / `http://127.0.0.1:4173/auth/callback` for development. Keep email confirmation enabled. Public signup and password recovery require custom SMTP: the default service sends only to project team members. Email setup is deferred at the owner's request. [Redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls), [SMTP configuration](https://supabase.com/docs/guides/auth/auth-smtp).

The repo is linked to Vercel project `plate-showcase`:

```sh
node --env-file=.env.local scripts/vercel-env.mjs
vercel deploy --yes
vercel deploy --prod --yes
```

The sync script configures preview/production without logging values. Node 24, Vercel Workflow, and OCR output tracing are configured. Large PDFs upload straight to Supabase through authenticated resumable TUS transfers. Workflow processes bounded pages and persists progress/recovery information. Menu imports support PDF, DOCX, plain text, and images. Personal catalogs require field/crop review before activation.

## Catalog provenance

The snapshot covers **83 collections and 184 product pages**, with **3,133 catalog records individually checked against the scan**. Original OCR text, corrected printed specifications, source-page links, normalized attributes, and authentic product crops are retained. **26 records retain source notes for missing or contradictory printed details**: the Miami MM-6 diameter, MS-710 diameters across two pages, AD-9014 diameters, two Olive capacities, the SM-10MT diameter, seven tray photograph/caption associations, and the PO-3006 case pack. Unknown measurement fields do not qualify for exact recommendation constraints. Records repeated in more than one collection retain those collection associations. Budget tiers are estimates; 3D geometry and food placement are illustrative.

`catalog-corrections.tsv` and the `catalog-source-*.json` manifests record the source transcriptions, color variants, material exceptions, case packs, and crop coordinates checked against the scan. `catalog_source_review.py` applies these corrections to a seed or during the full build. Complete reviewed pages remove false OCR rows and restore missed SKUs. Shared templates retain separately checked color variants; original OCR text and additional source references survive corrections.

The 196-page scan is processed by `extract-catalog-pages.py`, `prepare-ocr-crops.py`, `ocr-catalog.ps1`, `ocr-source-catalog.mts`, and `build-catalog.py` in `scripts`. Ignored `.cache` folders contain intermediate page images and OCR. Source paths may need updating if the supplied PDF moves.

Install the local catalog-processing Python dependencies with `pip install -r scripts/requirements-catalog.txt`. The reproducible build also prepares separate tabletop cutouts with `catalog_studio_images.py`: connected white margins are removed, then a one-pixel alpha inset and translucent edge color repair reduce scan halos on dark tables. This follows each photographed silhouette, including irregular pieces, and preserves the original catalog photographs. Run `python scripts/catalog_studio_images.py` to refresh cutouts without rerunning OCR, and `python scripts/test_catalog_studio_images.py` to verify shape and glaze preservation. Runtime AI generation is currently paused.

`python scripts/catalog_studio_bulk.py --refresh-inventory --fetch --minimum-subject 640 --workers 4` explicitly refreshes the public official inventory and prepares all verified associations. Without either network flag, the command uses the cached inventory and originals, resuming from completed files. `python scripts/catalog_studio_photos.py --fetch --collections legna mars iris-blue porto` remains available for selected plate/bowl collections. Original downloads stay in `.cache/studio-originals`; the resulting cutouts and their provenance are retained in the repository. Preparation respects orientation and color profiles, retains existing transparency, downsamples with Lanczos, and measures actual subject pixels. Glass highlight masks preserve the photographed white reflections; they do not simulate background refraction. Normal development and production builds use the checked-in assets and require no manufacturer requests.

`python scripts/audit_studio_resolution.py` measures every current tabletop asset's native nontransparent silhouette and writes per-SKU CSV and JSON reports under `.cache/studio-resolution-audit`. The [October 23 resolution audit](docs/studio-image-resolution-2026-10-23.md) records 2,906 export-ready product images, 94 official images with enough native detail for the desktop reference but requiring enlargement for export, and 133 retained scan records below 640 pixels. `resources/studio-photo-unavailable.json` lists those remaining SKUs: 122 lack a verified official photograph and 11 still have small official subjects. Counts distinguish catalog records from shared image files; resolution is an enlargement-risk indicator, not a subjective sharpness score.

The three illustrative starter food cutouts in `public/food/*-v2.webp` were previously prepared with the built-in imagegen tool. Their input assets and complete prompts are recorded in `resources/starter-food-provenance.json`. The current studio reuses these static assets without generating new images.

```sh
npm run catalog:ocr
python scripts/build-catalog.py
npm run catalog:check
```

## Validation

The [October 22, 2026 site audit](docs/site-audit-2026-10-22.md) documents storage and network failure recovery, saved-scene race fixes, request validation, accessibility, search metadata, and measured image-transfer reductions. With a local production server running, `npm run audit:ui -- latest --interactive` writes accessibility reports and desktop/phone screenshots under `.cache/site-audit/latest`.

The dependency follow-up in that report documents the scoped `mammoth -> argparse 2.0.1` override, which removes the vulnerable `sprintf-js` dependency while retaining Mammoth's CLI compatibility. The October 22 dependency refresh upgrades Next.js to 16.4.2, React/React DOM to 19.3.1, Supabase to 2.118.0, Workflow to 5.2.3, and compatible UI/test dependencies. The `braces` follow-up removes its dependency chain from the Next.js ESLint toolchain using the [local directory-glob adapter](tooling/next-eslint-glob/README.md), scoped to `@next/eslint-plugin-next@16.4.2`. Full and production-only dependency audits report zero vulnerabilities. Next.js lint rules stay enabled; regression tests exercise root discovery and an actual Next.js rule. ESLint stays on 9.x and TypeScript on 5.x; Node types stay aligned with the project's Node 24 runtime.

```sh
npm run test
npm run typecheck
npm run lint
npm run catalog:check
npm run build
npm run test:e2e
node scripts/test-public-site.mjs
```

Unit tests cover interpretation, fractions, strict constraints, refinement, ranking, imports, display families, URL validation, local draft validation, and food-provider request/alpha/error handling. Desktop/phone browser tests cover selection, grouped size specifications, scrolling dialogs, keyboard focus, URL sharing/reloads, local PDF/DOCX/image menus, downloads, account states, resumable upload UI, scene persistence, job recovery, review/activation, paused-generation behavior, tabletop/export pixel parity, and image-loading recovery. Account/workspace browser responses are mocked; run the separate hosted test to verify actual Supabase policies. Live email delivery awaits SMTP configuration, and paid AI verification awaits a configured provider key.

The October 22 tabletop and dependency update passed 145 unit tests and all 118 desktop/phone browser tests on Node 24.19.0, plus TypeScript, ESLint, catalog validation, and the production build. This validation covers local behavior.

The `braces` follow-up passed a clean `npm ci`, all 155 unit tests (including 10 lint-adapter regressions), TypeScript, ESLint, the production build, and full/production-only audits with zero reported vulnerabilities on Node 24.19.0.

The October 23 studio photograph update passed all 157 unit tests, five Python cutout/catalog-refresh tests, TypeScript, ESLint, catalog validation, and the production build. All 46 targeted desktop/phone browser tests passed against the local production build, covering tabletop/export pixel parity, LE-711's detailed source, image recovery, repeated piece changes, and Illustrative 3D controls and export. Asset tests verify all 118 SKU mappings, output hashes, native detail, and intact transparent margins. Catalog comparison confirmed that only the 118 `studioImage` paths changed; original images and product specifications were retained. This update has been validated locally.

The full official-photo follow-up passed all 158 unit tests, 14 Python tests, TypeScript, ESLint, catalog validation, and the production build. All 62 targeted desktop/phone cases passed, with eight affected glass/photo cases repeated after the final mask repair. Tests verify every one of the 3,000 published image hashes, exact associations or documented aliases, native subject detail, transparent margins, and unchanged original scan paths. Semantic catalog comparison confirmed that only 2,882 additional `studioImage` paths changed; all 3,133 product records and specifications were retained.

The previous full UI validation passed 73 unit tests, all 70 desktop/phone browser tests, TypeScript, ESLint, and the production build. The food-provider update passed all 97 unit tests, four focused desktop/phone Studio regressions, TypeScript, ESLint, and the production build; its paid API path still needs live evaluation with a configured key. The Italian preset features Legna LE-410, sushi concepts can feature Honda's rectangular serving forms, and explicit filters remain strict through refinement. The hosted metadata transaction verified all 83 collections; every product record and asset association remains unchanged. Public production smoke checks cover the 83-collection/3,133-record seed, assets, source discrepancies, strict recommendations, and anonymous route protection. Production is published at https://plate-showcase.vercel.app.

The real hosted policy test now passes, including a 7 MB resumable upload, owner-only tables/files, cached quota reservations, and cross-catalog association checks. `scripts/test-live-site.mjs` also verifies deployed saved scenes, menu processing, failure/retry recovery, PDF.js/Tesseract OCR, crop edits, source-text preservation, activation, cancellation, and missing-key behavior. It uses disposable confirmed accounts and removes its private files. It sends no email and invokes no paid AI generation. Set `LIVE_SITE_URL` to the deployment origin, then run it with Node and `--env-file=.env.local`; the one-page fixture is `.cache/live-catalog.pdf`.
