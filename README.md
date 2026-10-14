# Yanco dinnerware showroom

Public Next.js website with deterministic recommendations, a searchable source-linked catalog, and a plating studio. Anonymous visitors can use the baseline catalog and starter scenes. Supabase accounts unlock private imports, saved projects, and explicitly requested food-photo previews.

## Development

Use Node **24**. Read the installed Next.js guides in `node_modules/next/dist/docs` before changing framework code.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:4173. Each private setting goes on its own `NAME=value` line in the ignored `.env.local` file, **without commas**.

| Setting                                              | Value                                                                                                                                                     |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NEXT_PUBLIC_SUPABASE_URL                             | HTTPS project URL                                                                                                                                         |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY                 | Settings → API Keys → Publishable key (`sb_publishable_…`)                                                                                                |
| SUPABASE_SECRET_KEY                                  | Settings → API Keys → Secret key (`sb_secret_…`); server only. Legacy service-role JWT also works.                                                        |
| DATABASE_URL                                         | Connect → Connection string → URI (`postgresql://…`) with the database password. Use session pooler if direct IPv6 is unavailable. Local migrations only. |
| NEXT_PUBLIC_SITE_URL                                 | Public origin: https://plate-showcase.vercel.app                                                                                                          |
| OPENAI_API_KEY                                       | Optional server-only replacement key. Prior project's key failed authentication.                                                                          |
| AI_PREVIEW_DAILY_LIMIT / AI_PREVIEW_SITE_DAILY_LIMIT | Optional; defaults 5 per account / 50 per site per day.                                                                                                   |

Never put server keys or a database password in a `NEXT_PUBLIC_` variable. [Key guidance](https://supabase.com/docs/guides/getting-started/api-keys), [connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Hosted setup

```sh
npm run db:migrate
npm run db:seed
node --env-file=.env.local scripts/test-hosted.mjs
```

If you prefer to keep the database password out of local configuration, run `supabase/setup.sql` once in the project's SQL Editor. This creates the same versioned schema in a transaction. Then run the seed and hosted test commands using the server Secret key.

Migrations create `yanco_` tables, owner-based row-level security, and public catalog/private customer buckets. Seeding uploads referenced assets, reconciles only the baseline catalog, verifies row counts, then activates it. The hosted test creates two temporary confirmed accounts, checks isolation and storage policies, and removes its fixtures.

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

Install the local catalog-processing Python dependencies with `pip install -r scripts/requirements-catalog.txt`. The reproducible build also prepares separate tabletop cutouts with `catalog_studio_images.py`: only connected white margins are removed, preserving the original catalog photographs. AI is reserved for explicitly requested food layers.

The three illustrative starter food cutouts in `public/food/*-v2.webp` were prepared with the built-in imagegen tool. Their input assets and complete prompts are recorded in `resources/starter-food-provenance.json`. Runtime food previews use the separate authenticated, quota-controlled OpenAI integration.

```sh
npm run catalog:ocr
python scripts/build-catalog.py
npm run catalog:check
```

## Validation

```sh
npm run test
npm run typecheck
npm run lint
npm run catalog:check
npm run build
npm run test:e2e
node scripts/test-public-site.mjs
```

Unit tests cover interpretation, fractions, strict constraints, refinement, ranking, and imports. Desktop/phone browser tests cover selection, source links, downloads, account states, resumable upload UI, scene persistence, job recovery, review/activation, and AI failure behavior. Account/workspace browser responses are mocked; run the separate hosted test to verify actual Supabase policies. Live email delivery awaits SMTP configuration, and paid AI verification awaits a replacement server key.

The final verification passed 36 unit tests and 28 desktop/phone browser checks, TypeScript, ESLint, the production build, real hosted isolation/uploads, and deployed Workflow processing. Public production checks verified the 83-collection/3,133-record seed, assets, source discrepancies, strict recommendations, and anonymous route protection; three observed recommendation responses took 148–282 ms. Production is published at https://plate-showcase.vercel.app.

The real hosted policy test now passes, including a 7 MB resumable upload, owner-only tables/files, cached quota reservations, and cross-catalog association checks. `scripts/test-live-site.mjs` also verifies deployed saved scenes, menu processing, failure/retry recovery, PDF.js/Tesseract OCR, crop edits, source-text preservation, activation, cancellation, and missing-key behavior. It uses disposable confirmed accounts and removes its private files. It sends no email and invokes no paid AI generation. Set `LIVE_SITE_URL` to the deployment origin, then run it with Node and `--env-file=.env.local`; the one-page fixture is `.cache/live-catalog.pdf`.
