# My Workspace guidance and recovery

Date: October 24, 2026.

The menu flow previously separated an uploaded file from its result. Signed-in
users had to find a completed job further down the page and explicitly load its
text. Guest feedback appeared below the editor, and adding an image did not
clearly explain that its dishes still needed text.

## Resulting behavior

- The workspace introduces its three starting points: bring a menu, find
  dinnerware, and continue a saved table.
- A three-step menu guide explains adding the file, reviewing the dishes, and
  finding dinnerware. The upload feedback appears next to this guide.
- Guest PDF reading reports page progress. Images, empty extraction, truncated
  text, invalid files, and storage failures each explain how to continue.
- Account uploads distinguish transfer progress, starting processing, queued
  work, running work, completed text, failed processing, and cancellation.
  Filename and progress remain available in import activity.
- Completed account menus fill the editor automatically. Pasted, edited, and
  deliberately cleared text survive navigation and polling without replacement
  by an asynchronous result. Original extracted text can be loaded explicitly.
- Continuing into Expert mode carries the dishes across and shows a confirmation
  explaining how to request recommendations.
- Account sections load separately. A failure retains previously loaded work,
  identifies the affected section, and provides a retry action. Stalled reads
  become actionable errors after 20 seconds, using ordinary AbortController.
- Personal catalogs explain source review and activation. Review pages guide
  checking, correcting, saving, and activating; activation confirms its effect
  and links to the selector.
- Saved table settings have descriptive empty states and a studio entry point.
  Saved selections can be named, confirm successful saving, and reject an empty
  restaurant brief.
- The page waits for the initial account check before offering an upload form,
  avoiding a misleading guest form during signed-in initialization.

The visual treatment retains the existing Yanco fonts, color palette, and
catalog/studio layout. Mobile inputs use readable text, feedback uses live
status or alert regions, and progress bars are labeled.

## Validation

The final local production build, TypeScript, ESLint, and whitespace checks
pass with Node 24.22.1. The five browser suites below pass all 80 checks
across desktop and phone in 3.5 minutes. This includes the visibility,
accessibility, cancellation, and browser-compatibility cases.

The unit run excluding the existing image suite passes 159 tests across 13
files. The separately attempted full run and isolated image-suite rerun have
the image timeout described below; they are not counted as fully passing runs.

Browser coverage is in:

- `tests/browser/workspace.spec.ts`
- `tests/browser/workspace-guidance.spec.ts`
- `tests/browser/round3.spec.ts`
- `tests/browser/auth.spec.ts`
- `tests/browser/resilience.spec.ts`

These cover desktop and phone behavior, upload and processing feedback,
same-file upload retries, restoration before and after processing completes,
preservation of user edits, named saved selections, partial service failure,
catalog review and activation, cancellation, and menu handoff. Axe checks
uploaded-menu states for both guests and accounts against WCAG A/AA tags.
An explicit viewport assertion verifies that the guest upload result is visible
after choosing a file. The account flow is also checked without newer static
AbortSignal convenience methods.

Screenshots retained under `.cache/qa/`:

- `workspace-account-menu-desktop.png`
- `workspace-account-menu-phone.png`
- `workspace-image-guidance-desktop.png`
- `workspace-image-guidance-phone.png`
- `workspace-guidance-desktop.png`
- `workspace-guidance-phone.png`

Four unit tests in `tests/unit/workspace-request.test.ts` verify successful
responses, actionable server errors, stalled-request recovery, and cancellation
when leaving the workspace.

An existing full-image test,
`studio-photo-assets.test.ts / publishes genuine detail, intact alpha, and
reproducible output hashes`, exceeds its 180-second limit both in the initial
full unit run and when rerun alone. Its source and image assets are unchanged.
The other two image-suite cases pass; this timeout is separate from workspace
validation and is not reported as a passed full unit suite.

Account, storage, and background-workflow browser responses use fixtures. This
verifies the actual UI against those responses; it does not establish live
account upload, OCR, email delivery, or cross-device behavior. No production
deployment or customer data migration is included.
