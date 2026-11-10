# Ideas: themes for The Library

Status: **ideas only, nothing built.** Noted 11 Nov 2026 from the owner. Likely to come after the family launch (`plans/FAMILY.md`), as part of the Look settings family members can change.

## The rule
- The layout, formatting and features stay the same in every theme: same tabs, same panels, same places for things.
- A theme changes only:
  - the **page background** and the colour tokens (surfaces, text, accent, lines)
  - the **Reading now cards**
  - the **shelf spines** and the background shelf
  - optionally the **fonts** (still one body face plus one display face per theme)
- **Default:** today's look. Dark Proton base, the leather shelf along the bottom, the accent drifting through the month colours, and the spine colour modes. People can still adjust it.
- Each person picks their own theme. It should be saved with their account (Supabase settings) so it follows them across devices, not only in the browser.

## Theme ideas
| Theme | Feel | Reading now card | Notes |
|---|---|---|---|
| **Library** | A local library | A **library card**: lined paper, a typewriter font for entries, a red **DUE** date stamp for Approx finish, and recent days written like borrowing records | Card-catalogue drawers or a returns trolley for the shelf; stamp-style chips |
| **E-book** | Kobo or Kindle | E-ink greys, a crisp reading serif, minimal chrome, a page progress bar like an e-reader footer | Optional **DOS** variant for fun: green-on-black monospace, block cursor in the On page box |
| **Classical book** | Leather-bound classics | The cloth/leather card from Reading now option C (`nowcard` mock, 10 Nov), gilt labels, classic novel fonts | Page wear, foxing and yellowing on surfaces; marbled endpaper accents; matches the leather shelves |
| **Night time** | Soft and dark | Low-contrast dark card, warm dim accent | Darker hues, nothing bright; good for reading in bed |
| **Day time** | Clear for all-day use | Light card, strong text contrast | The everyday light theme |
| **Morning** | Soft but bright | Pale warm card, gentle pastels | Brighter hues than Night, softer than Day |
| **Easy on the eyes** | Accessibility first | High-legibility layout with no texture behind text | See below |

## Easy on the eyes (accessibility)
- **Dyslexia-friendly** (the owner's brother-in-law):
  - a highly legible font such as **Atkinson Hyperlegible** or **Lexend** (both on Google Fonts)
  - a little more letter and line spacing
  - no italics or all-caps labels
  - off-white or tinted backgrounds instead of pure white
  - shorter line lengths
  - no textures behind text
- **Colour-blind-safe:** nobody in the family needs it, but this theme can use the colour-blind-validated palette already used in Insights, so charts and status colours never rely on colour alone.
- Bigger tap targets and a slightly larger base text size.
- Consider making the dyslexia font an **option inside any theme** as well, so someone can have Library *and* the legible font.

## Possible extras
- An **auto** setting: Morning, Day or Night by time of day.
- A per-theme shelf (library returns trolley, e-reader carousel, oak bookcase).
- Preview themes in the Look settings before choosing.

## When it's built
- Define themes as sets of CSS tokens (`--bg`, `--surface`, `--fg`, `--accent`, fonts, card style) so every panel follows without per-panel code.
- Check every theme's text contrast and run the palette validator from the data-viz method, as for the Insights charts.
- Screenshot every theme at laptop and iPhone widths before shipping.
