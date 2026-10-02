# Framepack QA

Date: 2026-10-02. Platform: Windows, Node 24. Final local run: **19/19 unit, 36/36 production E2E**, zero failures. `npm audit`: **0 vulnerabilities**. [Release evidence](release-checks.json). No claim of real Safari or hardware mobile-device testing.

## Scope

- 19 unit tests: PNG/WebP/JPEG header parsing, all 8 EXIF orientations, large headers, animation, corrupt bounds and EXIF offsets, filename safety/collisions, width deduplication, HTML escaping and signed reduction math.
- 12 E2E scenarios per browser engine, run against the production static build: Chromium, Firefox and Playwright WebKit. Real ZIP downloads are unpacked and every image is independently decoded with Sharp; pixel dimensions, MIME, exact byte length, uniqueness, source width bounds and every `srcset` descriptor must agree with the manifest. Originals are absent from the export and the app forgets the queue on reload.
- Synthetic fixtures: mirrored/rotated JPEG orientations 1–8, transparent PNG and WebP, explicit green JPEG background, 40 px source, duplicates and Unicode/path-shaped names, corrupt and SVG-disguised PNG, APNG/animated WebP, 12 MP accepted and 15 MP rejected, count/per-file/aggregate byte limits, early output-budget rejection, Canvas MIME fallback, cancel/retry/clear, packing cancellation and later export.
- PNG orientation reference pixels are compared with independently auto-oriented source quadrants. This verifies rotation and reflection, beyond width/height assertions.
- Language/theme matrix: EN/RU, light/dark, keyboard Space and focusable table, 320/375/390 px mobile/touch emulation, desktop, 200% text reflow, error/cancel/retry states and automated axe scans. Automated axe results are not a WCAG conformance certification; real screen readers were not tested.

## Independent reviews

- [Code/security audit](code-security-audit.md) with independent pixel, ZIP, HTML injection and memory/cancellation probes. Scope and original defects are retained in the report. [Probe results](audit-probe-results.json), [WebKit results](audit-probe-results-webkit.json), [ZIP/UI results](audit-ui-probe-results.json), [actual audited ZIP](audit-demo-pack.zip).
- [Design/a11y audit](design-a11y-audit.md) with an independent browser and screenshot review. [Detailed results](design-a11y-results.json) and [screenshots](screenshots/).

Both audits prompted fixes: true source comparison, matching preview geometry, mobile widths reflow, keyboard-scrollable table, clearer partial-set denominator, error/cancel announcements, full-text reflow, inspector focus/navigation, actual interruptible ZIP worker and honest demo loading state.

## Network and storage

Chromium and Firefox execute demo → process → download/verify ZIP with `context.setOffline(true)` after the app loads, with zero HTTP/HTTPS requests. For Playwright WebKit, offline emulation rejects reading even a freshly created three-byte Blob with `NotReadableError`. Its complete workflow is instead verified while every HTTP/HTTPS request is blocked and local `blob:`/`data:` URLs remain available. This is recorded as an emulator limitation, not a Safari offline claim. The ZIP worker is bundled inline, so it needs no later network fetch.

No analytics, remote fonts or image requests exist in the application. The only localStorage keys hold language and theme. File objects, blobs and results are held in memory; reload clears them. Source bitmaps/canvas stores are released in finally; selected original/variant URLs use effect cleanup; row thumbnails are revoked on remove/recipe reset/clear/unmount. ZIP download URL is revoked after a 10-second grace period.

## Deliberate limits

20 files, 15 MiB per file, 80 MiB source total, 12 MP, 8,192 px maximum side; result assets capped at 80 MiB as they are encoded. Sequential processing limits simultaneous decoder allocations. Device memory and browser implementation still vary. No animation, SVG/HTML/GIF/AVIF or remote URL input. PNG/WebP EXIF is explicitly rejected. No target KB guarantee, metadata sanitization guarantee, first-load offline support or real Safari coverage.

Exact public URL, source/deployment commits and final run results are recorded in the delivery after the live verification.

## Live release

https://moyisey.github.io/framepack/ — HTTP 200; live CSS/JS SHA-256 exactly match the locally verified production build. Full public-site E2E: **33/33 passed**, Chromium/Firefox/Playwright WebKit. [Live evidence](live-checks.json). The archived live run covers the initial functional release. The final preview hardening also verifies a 256 × 8192 source: queue thumbnails stay within 256 × 256, while the ZIP keeps the true 256 × 8192 dimensions. The full updated production suite passes 36/36.

GitHub [Quality](https://github.com/MOYISEY/framepack/actions/runs/36991185076) and [Pages deployment](https://github.com/MOYISEY/framepack/actions/runs/36991291197) succeeded. The repository is new; no existing project, portfolio or profile README was modified.
