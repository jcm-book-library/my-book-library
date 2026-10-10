# Jackets & Manuscripts: brand handoff

Brand assets for the book library app. This file is written so it can be handed to a coding session along with the folder.

## Decisions made

| Item | Decision |
|---|---|
| App name | Jackets & Manuscripts |
| Mark | "JM" monogram. The J's spine is also the M's first leg. |
| Mark colour | Matches the app's colour for the current month. |
| Wordmark colour | Neutral off-white, `#eef0fa`, including the ampersand. It does not change by month. |
| Typeface | Atkinson Hyperlegible, weight 700 for the wordmark. |
| Background | The app's dark ground, sampled as `#202230`. |

## What the mark is made of

- **J:** a spine with a rounded top that thins into a pointed sweep at the bottom, with a separate round dot in the crook. Together they read as a rolled manuscript.
- **M:** drawn as one pen-width line with rounded turns. The first diagonal folds out from behind the J's spine, shown by a soft shadow.
- **Tail:** the M's last leg is short and ends in a sharp bookmark notch. This is the only deliberately sharp corner besides the J's tip.

Keep the dot, the fold shadows and the notch. They carry the meaning of the mark.

## Files

| File | Use |
|---|---|
| `svg/jm-mark.svg` | Master mark. Fills use `currentColor`, so inline it and set CSS `color` to the month's colour. |
| `svg/jm-mark-blue.svg` | Fixed-colour version (`#5591e0`) for places that can't inline SVG. |
| `svg/jm-mark-neutral.svg` | Off-white version (`#eef0fa`). |
| `svg/app-icon.svg` | Square icon: blue mark on the dark ground, full bleed. |
| `png/icon-512.png`, `png/icon-192.png` | PWA / manifest icons. |
| `png/apple-touch-icon.png` | 180 px home-screen icon. |
| `png/favicon-32.png`, `png/favicon-16.png` | Favicons, transparent background. |
| `png/jm-mark-blue-1024.png` | Large transparent mark. |
| `png/lockup-horizontal.png`, `png/lockup-stacked.png` | Reference images of the two lockups. Build the real ones in HTML/CSS as below. |
| `fonts/*.woff2` | Atkinson Hyperlegible 400 and 700 (Latin), for self-hosting. Licence: SIL Open Font License 1.1, in `fonts/OFL-LICENSE.txt`. |

The fixed-colour files and all PNGs use August's blue, `#5591e0`, as a stand-in default. Re-render them from `svg/jm-mark.svg` if a different default is wanted.

## Using the mark in the app

Inline the SVG so the colour can follow the month:

```html
<span class="jm-mark" style="color: var(--month-colour)">
  <!-- contents of svg/jm-mark.svg -->
</span>
```

- The SVG has a square `viewBox` (`71 61 280 280`) with a small built-in margin, so size it with `width` and `height` only.
- The two gradient ids are `jm-fold-a` and `jm-fold-b`. If the SVG is inlined more than once on a page the duplicate ids still resolve, but rename them if a linter objects.
- The fold shadows are black at low opacity laid over the mark, so they work on any mark colour.

## Wordmark and lockups

```css
@font-face {
  font-family: "Atkinson Hyperlegible";
  font-weight: 700;
  src: url("fonts/atkinson-hyperlegible-latin-700-normal.woff2") format("woff2");
}
.jm-wordmark {
  font-family: "Atkinson Hyperlegible", sans-serif;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #eef0fa;
}
```

Proportions, relative to the mark's width:

| Lockup | Layout | Text size | Gap |
|---|---|---|---|
| Horizontal | Mark left, name on two lines ("Jackets &" / "Manuscripts"), line-height 1.06 | 0.38 × mark | 0.14 × mark |
| Stacked | Mark above, name on one line, centred | 0.23 × mark | 0.08 × mark |

Below roughly 24 px, use the mark alone without the name.

## Month colours

Sampled from a screenshot of the app's chart, so treat them as approximate and prefer the app's own values.

| Month | Colour |
|---|---|
| Jan | `#e8935a` |
| Feb | `#e07a7a` |
| Mar | `#d9738f` |
| Apr | `#c573b4` |
| May | `#a674e0` |
| Jun | `#7f6cf5` |
| Jul | `#6a7ff0` |
| Aug | `#5591e0` |
| Sep | `#3fa4b8` |
| Oct | `#336e65` |
| Nov | not sampled |
| Dec | not sampled |

## Still to sort out in the app

- **October contrast:** `#336e65` is dim against `#202230`. Consider a lighter green for the mark in that month.
- **November and December:** colours were not visible in the screenshot.
- **Static icons:** the PNG icons can't change by month. Either keep one default colour for them or swap the favicon to an inline SVG that follows the month.
- **Reading text:** Atkinson Hyperlegible was chosen for the wordmark. Whether it is also used for body text in the app is undecided; Roboto was the second choice.
