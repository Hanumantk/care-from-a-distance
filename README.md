# Care from a Distance — parent health app

An interactive prototype for helping an adult child manage an aging parent's
health from another city. Eight screens, built as a working front-end rather
than a clickable image, so the flows can actually be used.

Designed in Figma and implemented here in plain HTML, CSS and JavaScript —
no framework, no build step.

---

## Running it

Any static server works. From the project root:

```bash
npx http-server . -p 4173 -c-1
```

Then open <http://localhost:4173/index.html>.

Opening the files directly with `file://` will not work — the screens load
shared stylesheets and scripts that need an HTTP origin.

### On a phone

Open the same URL on a handset and the app fills the screen — no tiny
phone-inside-a-phone, and no second set of fake status bars on top of the
real ones.

Five of these screens are traced from Figma with absolutely positioned
children on a 393px grid, so they cannot reflow to an arbitrary width
without being redrawn. Instead `viewport.js` tells a portrait phone to lay
the page out at 393 and scale that to the physical screen: a 360px Android
renders at 0.92x, a 430px Pro Max at 1.09x, and every proportion stays as
designed. Height is the part that really varies, so the frame takes
`100dvh` — the tab bar pins to the true bottom edge and follows the URL bar
as it slides away.

Tablets and desktops keep the iPhone 16 mock, because they are wide enough
to show the 393 frame at 1:1 and blowing it up 2x would look broken.

### Screenshots

On a laptop or tablet, the camera button in the top-right corner of the
page saves the current screen, in its iPhone frame, as a PNG
(`care-from-a-distance-<screen>-<time>.png`). It keeps the scroll
position and any open sheet. It sits outside the phone, never on the app,
so it hides on windows narrower than 540px and on phones. Use the phone's
own screenshot there.

---

## The screens

| File | Screen |
|---|---|
| `index.html` | Home — today's status, upcoming visit, vitals |
| `visits.html` | Visits — upcoming and past, newest first |
| `upcoming-visit.html` | An upcoming visit in full, with a delete option — and, on the day, the visit in progress |
| `visit-detail.html` | A past visit: summary, findings, prescription, recording |
| `medicine.html` | Medicine — schedule and the full tablet list |
| `settings.html` | Settings — care circle, preferences |
| `add-visit.html` | Book a visit — the long form |
| `add-visit-review.html` | Review and confirm |

Each screen renders inside an iPhone 16 shell: a 393 × 852 viewport with the
Dynamic Island, status bar and home indicator, and its own scroll.

---

## What actually works

The prototype is stateful, not a set of static mockups:

- **The booking form is live.** Searching filters hospitals; picking one
  re-derives the doctor list; the calendar is generated from the doctor's
  clinic days (Tue / Thu / Sat, nothing in the past); choosing a time
  auto-computes the pickup time from the travel estimate.
- **Progress survives a reload.** The form saves a draft as you go.
- **Confirming creates a real visit**, which sorts into the Visits list by
  date and updates Home's upcoming card.
- **Deleting a visit works**, including the ones that ship with the app.
- **Validation gates the CTA** and tells you what is still missing.

State lives in `localStorage` under `pha.*` keys, with a try/catch fallback to
memory so private-browsing mode degrades rather than breaks. `PHA.resetAll()`
in the console returns everything to the designed state.

### Visit in progress

From the day before, the 24 OCT visit stops being a booking and becomes a
status board Hanu can glance at once: the current stage in one line, the
helper with one-tap calls, an eight-stage timeline, the questions ticked
off as they are asked, and a running total with receipts. Four exceptions
(helper late, doctor absent, Maa not ready, emergency) arrive as a red
banner above everything else. Maa's location is never shown: the only map
is the helper's route to her door, and it goes away at pickup.

Home's upcoming card opens this page, and its chip follows the stage. It
opens mid-visit ("With doctor") until the Demo controls move it.

For presenting, a small **Demo** pill in the corner steps through stages
(or use ← and →) and picks an exception. The state is in the URL, so any
moment opens directly:

```
upcoming-visit.html?id=seed-1&stage=5&issue=none
```

Reset goes back to stage 1. `stage` runs 0 (the plain booking view) to 8; `issue` is one of `none`,
`helper-late`, `doctor-absent`, `not-ready`, `emergency`.

---

## How it is put together

```
shell.css          device shell, iOS chrome, scroller, tab bar, design tokens
<screen>.css       one stylesheet per screen, importing shell.css
app.js             shared store: visits, draft, dates, availability rules
<screen>.js        per-screen behaviour
assets/            60 SVGs exported from Figma
```

Two layout conventions, used deliberately:

- **Screens traced from Figma** (`index`, `visits`, `visit-detail`, `medicine`,
  `settings`) position their children absolutely, on the exact coordinates the
  design file reports. Every node was measured in-browser against Figma rather
  than eyeballed.
- **Screens authored here** (`add-visit`, `add-visit-review`,
  `upcoming-visit`) use flow layout on the same 24px gutter, because a long
  form needs to reflow when its content changes.

Card edges are drawn with an inset `box-shadow` rather than a border. A real
sub-pixel border (0.2px / 0.5px) gets rounded up for layout by Chrome, which
shifted every child inside the card; a shadow sits outside layout, so the
coordinates stay exact.

---

## Accessibility

Colour choices were checked rather than assumed — contrast ratios computed
from rasterised sRGB, not eyeballed:

- Body text meets WCAG 2.1 AA (4.5:1); large text and UI boundaries meet 3:1.
- The destructive "Delete" control uses `#c0392b` (5.0:1) rather than the
  app's `#ed4546`, which measures 3.8:1 and fails at a 12px label.
- Status is never carried by colour alone — every chip is labelled.

---

## Credits

Design and build by Hanu, B.Des at IDC School of Design, IIT Bombay.
Type is [Poppins](https://fonts.google.com/specimen/Poppins); icons are
[Phosphor](https://phosphoricons.com/).
