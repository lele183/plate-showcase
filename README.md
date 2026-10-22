# Yanco dinnerware showroom

Public Next.js website with deterministic recommendations, a searchable source-linked catalog, and a plating studio. Anonymous visitors can browse, read menus on their device, and save local starter scenes. Supabase accounts unlock hosted imports, cross-device saved projects, and explicitly requested food-photo previews.

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

Food generation edits the uploaded dish into a transparent layer, which is reused across exact catalog photographs. Qwen's supported API infers transparency from the prompt; OpenAI uses its explicit `background=transparent` option. The server verifies the returned alpha channel before replacing the photo. Requests generate one image, preserve the existing per-account/site quotas and upload cache, and never automatically retry or switch to another paid provider. Job results record the provider and model.

To use Qwen, set `AI_PREVIEW_PROVIDER=qwen`, `DASHSCOPE_API_KEY`, and the matching `DASHSCOPE_REGION` in `.env.local`. If the console provides a workspace-specific API host, set `DASHSCOPE_API_HOST` to its HTTPS origin, for example `https://WORKSPACE.ap-southeast-1.maas.aliyuncs.com`. The legacy regional endpoints remain the defaults for existing DashScope keys. A configured provider without its own key remains unavailable even if another provider's key is present. Region and model availability depend on the account.

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

Install the local catalog-processing Python dependencies with `pip install -r scripts/requirements-catalog.txt`. The reproducible build also prepares separate tabletop cutouts with `catalog_studio_images.py`: connected white margins are removed, then a one-pixel alpha inset and translucent edge color repair reduce scan halos on dark tables. This follows each photographed silhouette, including irregular pieces, and preserves the original catalog photographs. Run `python scripts/catalog_studio_images.py` to refresh cutouts without rerunning OCR, and `python scripts/test_catalog_studio_images.py` to verify shape and glaze preservation. AI is reserved for explicitly requested food layers.

The three illustrative starter food cutouts in `public/food/*-v2.webp` were prepared with the built-in imagegen tool. Their input assets and complete prompts are recorded in `resources/starter-food-provenance.json`. Runtime food previews use the separate authenticated, quota-controlled Qwen or OpenAI integration.

```sh
npm run catalog:ocr
python scripts/build-catalog.py
npm run catalog:check
```

## Validation

The [October 22, 2026 site audit](docs/site-audit-2026-10-22.md) documents storage and network failure recovery, saved-scene race fixes, request validation, accessibility, search metadata, and measured image-transfer reductions. With a local production server running, `npm run audit:ui -- latest --interactive` writes accessibility reports and desktop/phone screenshots under `.cache/site-audit/latest`.

The dependency follow-up in that report documents the scoped `mammoth -> argparse 2.0.1` override, which removes the vulnerable `sprintf-js` dependency while retaining Mammoth's CLI compatibility. The October 22 production dependency audit reported zero vulnerabilities; five development entries remained from an unpatched `braces` issue in the Next.js ESLint toolchain.

```sh
npm run test
npm run typecheck
npm run lint
npm run catalog:check
npm run build
npm run test:e2e
node scripts/test-public-site.mjs
```

Unit tests cover interpretation, fractions, strict constraints, refinement, ranking, imports, display families, URL validation, local draft validation, and food-provider request/alpha/error handling. Desktop/phone browser tests cover selection, grouped size specifications, scrolling dialogs, keyboard focus, URL sharing/reloads, local PDF/DOCX/image menus, downloads, account states, resumable upload UI, scene persistence, job recovery, review/activation, and AI failure behavior. Account/workspace browser responses are mocked; run the separate hosted test to verify actual Supabase policies. Live email delivery awaits SMTP configuration, and paid AI verification awaits a configured provider key.

The previous full UI validation passed 73 unit tests, all 70 desktop/phone browser tests, TypeScript, ESLint, and the production build. The food-provider update passed all 97 unit tests, four focused desktop/phone Studio regressions, TypeScript, ESLint, and the production build; its paid API path still needs live evaluation with a configured key. The Italian preset features Legna LE-410, sushi concepts can feature Honda's rectangular serving forms, and explicit filters remain strict through refinement. The hosted metadata transaction verified all 83 collections; every product record and asset association remains unchanged. Public production smoke checks cover the 83-collection/3,133-record seed, assets, source discrepancies, strict recommendations, and anonymous route protection. Production is published at https://plate-showcase.vercel.app.

The real hosted policy test now passes, including a 7 MB resumable upload, owner-only tables/files, cached quota reservations, and cross-catalog association checks. `scripts/test-live-site.mjs` also verifies deployed saved scenes, menu processing, failure/retry recovery, PDF.js/Tesseract OCR, crop edits, source-text preservation, activation, cancellation, and missing-key behavior. It uses disposable confirmed accounts and removes its private files. It sends no email and invokes no paid AI generation. Set `LIVE_SITE_URL` to the deployment origin, then run it with Node and `--env-file=.env.local`; the one-page fixture is `.cache/live-catalog.pdf`.
