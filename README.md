# Framepack

**A local image handoff workspace by Bakhtiyar Zikirin ([MOYISEY](https://github.com/MOYISEY)).**

[Use Framepack](https://moyisey.github.io/framepack/) · [QA](qa/QA.md) · [Portfolio case](CASE.md)

Load JPEG, PNG or still WebP images, select output widths and a format, inspect real encoded file sizes, then download a ZIP containing `assets/`, `manifest.json`, `responsive.html`, and a handoff guide. The responsive descriptors match encoded pixel widths. Small sources are never enlarged; repeated widths are collapsed.

This is a focused preparation tool for designers and developers. It does not edit your originals, invent alt descriptions, promise a target KB size, or replace an image editor.

## Run

Node 22.12+ (or current Node 24 LTS).

```sh
npm ci
npm run dev
```

Production uses a static Vite build with `base: '/framepack/'` for GitHub Pages.

```sh
npm run build
npm run preview
```

## Verify

```sh
npm test
npm run fixtures
npx playwright install chromium firefox webkit
npm run build
npm run test:e2e
```

E2E runs the **production build** and independently unpacks actual downloaded ZIPs. Sharp validates every asset's format, dimensions and length against the manifest and HTML. Synthetic fixtures cover all eight JPEG EXIF orientations, transparent PNG/WebP, JPEG background, tiny sources, duplicates and Unicode names, corrupt files, animation, 12 MP input, byte limits, cancellation/retry, MIME fallback and working without a network after the app has loaded. Playwright WebKit is not a real Safari test.

## Limits and semantics

- 20 source files; 15 MiB each; 80 MiB total source bytes; 12 million source pixels; 8,192 px maximum side. Headers are checked before decoding. Results are capped at 80 MiB as they are generated, and images are processed sequentially.
- JPEG, still PNG and still WebP contents only. No SVG, HTML, GIF, AVIF or remote URLs. Animated PNG/WebP is rejected. PNG/WebP containing EXIF is rejected rather than silently handling orientation incorrectly.
- Browser `createImageBitmap(..., { imageOrientation: 'from-image' })` applies JPEG EXIF; decoded dimensions must match preflight dimensions. All orientations, including mirrors, are tested against reference pixels.
- PNG/WebP preserve alpha. JPEG uses the selected explicit background. PNG ignores the quality slider. Actual `Blob.type` must match the selected encoder; PNG fallback is an error. Browser encoders and color management can produce different bytes. Re-encoding may change metadata/profiles; no forensic sanitization claim is made.
- A variant's reduction is `(originalBytes − variantBytes) / originalBytes × 100`. Larger results are shown as larger. The asset sum includes every responsive variant and is compared only with the corresponding ready originals; ZIP bytes are shown separately after download. These totals can grow.
- ZIP paths use bounded ASCII names, unique across the queue. HTML alt is user-authored and escaped. Empty alt is `alt=""` for decorative images; the user must decide whether that is appropriate. Adapt `sizes` to your CSS layout.
- Cancel processing at the next decode/encode boundary. ZIP assembly runs in an interruptible dedicated worker. Object URLs, image bitmaps and canvas backing stores are released when no longer needed.

## Privacy

No image upload, analytics, remote fonts, paid APIs or server processing. Images/results live in memory and disappear from the app after reload. Only language and theme preferences use localStorage. Your exported ZIP is saved only when you choose Download. Once the production app has loaded, the complete synthetic workflow was verified in offline Chromium/Firefox contexts and with every HTTP/HTTPS request blocked in Playwright WebKit (whose offline emulator rejects local Blob reads). A first load or reload still requires the site; this is not an installable PWA.

## Interface

English/Russian, light/dark, file chooser and drag/drop, per-file progress/retry, visible focus and keyboard controls, responsive workspace, compact original and output comparison, and manual alt fields. No stock assets: demos are generated locally from original geometric test patterns.

## References

- [Canvas toBlob: MIME fallback and quality](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob)
- [Responsive images and width descriptors](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Responsive_images)
- [createImageBitmap and orientation](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap)

MIT licensed. Built with React, TypeScript, Vite and fflate.
