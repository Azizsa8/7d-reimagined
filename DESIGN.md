# 7D International — recovery design system

Riyadh at dusk: quiet dark surfaces, warm type and restrained brass. Photography and
published project renders are the visual evidence. Never substitute invented architecture.

## Tokens

| Role | Value |
|---|---|
| Ground / raised ground | `#0A0C10` / `#0D1116` |
| Panel / raised panel | `#12171D` / `#171D24` |
| Primary / secondary / tertiary text | `#F4F1EA` / `#AFA898` / `#ADA594` |
| Action and focus | `#E0A94A` |
| Supporting sand / horizon | `#C8AA7C` / `#E9B27A` |
| Secondary accent | `#2FA98B` (not a verified logo colour) |
| Quiet borders | ivory at 14%, decorative dividers at 7% |

Legacy `--mint` variables alias brass; do not introduce mint as the main colour.
Brass buttons use night-coloured text. Image captions have an opaque-enough night panel;
never put body copy directly on a bright render. Small muted text must pass 4.5:1 against
its actual composited surface. Thin borders are decorative, not the sole state indicator.

## Typography and spacing

English display: Syncopate, 700. Body: Archivo, 300–600. Arabic: Tajawal, 400–800,
including headings; preserve Arabic shaping and remove Latin tracking. IBM Plex Mono is
reserved for indices and technical labels. Do not apply uppercase or wide tracking to Arabic.
Hero and section headings use fluid clamp scales already defined in index.html; project
headings 20–32 px, body 15–18 px, labels 11–12 px. Compact mobile cards may use 13 px body.

Use a 4 px spacing unit: 8, 12, 16, 24, 32, 48, 64. Page gutters 22 px mobile and 40 px
desktop. Content width 1200 px. Keep headings, globe and statistics in separate regions.
Desktop globe occupies the opposite side from copy; mobile globe sits between heading and
stats. RTL mirrors this composition through logical positioning.

## Components

- Project scenes: one published image, source link, short bilingual description, share and
  enquiry controls. Four numbered keyboard-operable buttons share the tour's 0–1 progress.
  Hidden cards are inert. No DSS/HQ architecture without actual source imagery.
- Globe: near-black sphere; brass, screen-sized dots on an icosphere lattice; warm narrow
  rim; surface discs; projected HTML labels; great-circle arcs. No buildings, beams or city boxes.
- Navigation: actual published raster logo while vector is pending. No diamond placeholder.
- Buttons: 40–44 px minimum control height, visible focus ring, text labels for state.
- Existing discipline diagrams are abstract explanatory graphics, not architectural renders.
  They remain until authored replacements have a defined, approved production budget.
- Enquiries use the published email, telephone and official contact page. Do not invent a
  response-time SLA or label an unverified number as WhatsApp Business.

## Motion

Primary easing: `cubic-bezier(.22,1,.36,1)`; scene opacity 550 ms; image scroll push-in
1.5–5%. No continuous project rendering loop. Globe draws only while visible and the tab
is active. Reduced motion uses static images and globe, immediate tour cuts, no pulses,
no cursor follower, and a static wrapping news rail. No paid generation is part of this route.

## Acceptance

Check English and Arabic at 1440×900 and 390×844, including tour captions, all four
projects, all seven disciplines, section seams, focus, reduced motion and source links.
Client Arabic review, real Android performance and the vector logo remain external gates.
