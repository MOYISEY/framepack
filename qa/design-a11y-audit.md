# Independent design and accessibility audit

**Final result: PASS within the tested scope. No unresolved design/a11y release blockers.**

Framepack, 2026-10-02. The delegated design/a11y auditor reviewed src/main.tsx, src/styles.css and src/i18n.ts independently of implementation and code/security review. Final checks used Playwright Chromium and axe-core against the production build at http://127.0.0.1:4174/framepack/. This auditor modified only qa/ files.

## Resolved findings

| Finding | Independently verified correction |
| --- | --- |
| Original comparison used a 256 px PNG thumbnail | The inspector now displays the original File through a scoped object URL. The demo original has natural dimensions 1600 x 1000, versus a 640 x 400 variant, with matching fitted display bounds. |
| Mobile widths overlapped Format | Widths span the recipe, wrap, and stay inside the fieldset at 320 px. |
| Variant table could not receive keyboard focus | Named focusable region with a visible outline; ArrowRight changed scrollLeft from 0 to 80 px. |
| Partial-set percentage label was ambiguous | The label explicitly says ready originals in both languages. A 1/8-ready cancelled run excludes the other seven originals from that comparison denominator. |
| Errors/cancellation lacked an explicit live summary | Error text has role=alert. The live region includes ready, failed and cancelled counts. |
| Enlarged text clipped the recipe at 768 px | Wrapping widths, fieldset minimum-size reset and earlier single-column reflow fix this. Complete enlarged text also passes at 1440 px. |
| Compare did not bring its result into view | Keyboard Enter focuses #compare-title and brings the heading into the viewport. |
| Enlarged text overflowed 320 px | Header/headings wrap, narrow recipes use one column and queue controls use a separate line. Final scrollWidth equals 320 px. Close-up screenshots show no clipped recipe or row controls. |
| Error thumbnails referenced an absent ARIA target | aria-controls is conditional; the error-only queue now has zero axe violations. |

## Final checks

- **18 visible-state axe scans: zero violations. Zero application page errors.** Tags: WCAG 2 A/AA, 2.1 A/AA and 2.2 AA.
- RU/EN and light/dark ready states at 1440 and 320 px passed. Language updates document language and labels; preference changes preserve the queue. Tested states passed axe contrast checks.
- Empty, processing, failed, cancelled, retried and ready states have clear actions. Eight synthetic 3000 x 2000 PNG files exercised real processing, cancellation retaining one ready image and seven cancelled rows, successful retry and rerun to eight ready images.
- Keyboard skip link, Space on width buttons, Enter on Compare and mobile table arrow-key scrolling passed. Control names and visible focus styles were checked.
- Failed live text: Ready: 0/1; Failed: 1; Cancelled: 0. Cancelled live text: Ready: 1/8; Failed: 0; Cancelled: 7.
- Emulated touch at 375 px toggled a width, generated and built three synthetic demo images, and changed theme.
- Text checks included root font-size 200% at 768 px and doubling every precomputed CSS font size, including explicit px captions, at 768 px before reflowing that enlarged text at 320 and 1440 px. All final viewport widths equal document scroll widths. This is a text-enlargement check, not a claim about native browser zoom UI testing.
- The interface distinguishes individual variant size changes from aggregate asset weight and ready-original comparisons. The manual alt field does not invent descriptions. No guaranteed target size, AVIF encoder or forensic metadata scrubber is advertised.

## Evidence

- [Repeatable script](audit-ui.mjs)
- [Final machine results](design-a11y-results.json)
- [Desktop ready](screenshots/desktop-en-light-ready.png)
- [Russian mobile ready](screenshots/mobile-320-ru-light-ready.png)
- [Complete 200% text at 320 px](screenshots/all-text-200-percent-320-en-dark-ready.png)
- [Enlarged mobile header](screenshots/text-200-mobile-header-detail.png)
- [Enlarged mobile recipe](screenshots/text-200-mobile-recipe-detail.png)
- [Enlarged mobile queue](screenshots/text-200-mobile-queue-detail.png)
- [Complete 200% text at 768 px](screenshots/all-text-200-percent-768-en-dark-ready.png)
- [Complete 200% text at 1440 px](screenshots/all-text-200-percent-1440-en-dark-ready.png)
- [Cancelled queue](screenshots/desktop-en-dark-cancelled.png)
- [Emulated touch](screenshots/touch-375-en-dark-ready.png)

Run node qa/audit-ui.mjs with the local dev server on port 4173, or set LIVE_URL to a production preview URL. The script writes result JSON and screenshots and uses only synthetic local images.

## Limits

Clean axe output is not a WCAG certification. Live-region DOM semantics were checked without NVDA/JAWS/VoiceOver; touch was emulated without a physical device. This independent audit used Chromium and does not claim real Safari testing. Cross-browser encoders, orientation, transparency, corrupt/large files, ZIP contents, offline behaviour and the deployed site are checked separately by implementation/code-security QA. Larger hit areas for the footer's inline links and the range track remain optional polish; no automated target-size failure was reported.
