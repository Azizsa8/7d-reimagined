# ASTRA recovery — implementation and acceptance record

Owner instruction: “go with whatever mentioned in the doc” (2026-09-13).
This selects the recommended cinematic destination and the zero-cost published-image
fallback for the recovery demo. It is not approval of a paid job. No paid generation,
render service, voice job, subscription upgrade or message to the client was performed.

## Implemented

- A: PR #1 merged into production as `2603385`. Continuous animation verified before
  merge; missing texture requests and perpetual polling removed; plugin auto-enablement
  removed; ignore rules and brand documentation corrected.
- C/F: four actual published project JPEGs replace all procedural buildings. DSS and HQ
  building scenes removed. Each surviving project links to its published source.
- D: lazy real-time globe, icosphere land-dot sampling, limb fade, narrow neutral rim,
  surface hubs, bilingual HTML labels, great-circle routes and separate layout regions.
- G: project tour uses four-scene progress. Both complete tours recorded. Closing
  narration no longer promises a response time; stale closing MP3 references removed.
  Caption/browser-speech fallback matches the edited text. Remaining Arabic MP3s use the
  previously generated placeholder voice, not the intended Saudi voice.
- H: DESIGN.md; actual published raster logo; dedicated Arabic typography; source audit;
  unverified counters and claims removed; published contact details used.
- I: proximity image loading; static reduced-motion mode; inert hidden project/tour
  controls; keyboard scene buttons; bilingual metadata; hreflang, sitemap, sharing image,
  Organization/Project JSON-LD; service-worker version bumped and non-page offline failures
  no longer return HTML in place of an asset.

## Evidence

`qa/recovery/index.html` is the screenshot/reference comparison and video gallery.
`browser-report.json` records viewport/language checks, HTTP/page errors, keyboard controls,
image laziness and reduced-motion behavior. `tour-report.json` records all eight chapters
completing in each language; WebM recordings are screen-only (no captured audio track).
`axe-report.json` records the scoped automated accessibility scan. Lighthouse reports are
lab results, not real-device acceptance. Evidence and offline QA tools are excluded from
Vercel deployment by `.vercelignore`.

## External gates — not represented as complete

| Gate | Needed to finish |
|---|---|
| Four authored cinematic scenes (E) | Artist/source models, render specification and explicit quote approval. Blender is not installed on this host; ffmpeg is available. No authored assets have been supplied. |
| Saudi Noorah voice (G) | Approved paid tier/job cost, then regenerate all Arabic clips and both edited closing clips. |
| Real vector logo (H) | Client vector file. The actual published PNG is the interim mark. |
| Arabic approval (H/J) | Name and sign-off of a reviewer at 7D Riyadh. Current translation is a draft. |
| Android performance (I/J) | Physical mid-range Android and 4G test; local Chromium emulation is insufficient. |
| Direct delivery form / WhatsApp (I) | Approved email delivery provider/configuration and verified WhatsApp Business number. Current path opens official contact form, email or telephone; no success/delivery is fabricated. |
| Analytics (I) | Owner's tool selection and privacy requirements. No tracker installed. |
| Final client acceptance (J) | Owner review of visuals, deadline and approval to present the recovery demo. |

The original emergency fallback is delivered as a reviewable recovery, not as completion
of the paid cinematic route. No claim of full definition-of-done acceptance is made.

Offline QA tooling: Lighthouse 13.4.1 and @axe-core/playwright 4.13.0 installed in `/tmp`
only. The dependency-reviewer package-risk route was invoked; Endor risk tooling was
unavailable, so its result was UNKNOWN, not verified-safe and not a known vulnerability.
