# Presentation style: ERNI look

Reference style for decks (PPTX or slide artifacts). Clean, light, corporate Swiss look: white slides, navy regular-weight titles, a gray key message on the right, flat cards, navy line icons and thin navy lines. Calm and text-led; color is used structurally, not decoratively.

## 0. Use the real template first

If the ERNI template file (.potx or .pptx) is available, build from it. With python-pptx, open the template and add slides by **layout name** (see section 9). Do not rebuild masters, the header, the logo, gradient bars or theme colors by hand. Hex values below are estimates taken from screenshots; in the template, use theme color slots instead.

Recreate the look manually (this guide) only when the template is not available, for example in HTML slide artifacts.

## 1. Format

- 16:9, 13.333 x 7.5 in. HTML canvas: 1920 x 1080 px.
- Conversions: 1 pt = 2 px, 144 px = 1 in.
- Flat design: no shadows, rounded corners, glow or 3D. The only gradients are the template's group bars (pattern 4).
- One idea per slide.

## 2. Colors

| Role | Approx. hex | Theme slot | Use |
|---|---|---|---|
| Navy | `#17366F` | Accent / Text 2 | Titles, subtitles, headings, icons, bullets, lines, outlines, header bars, section and back-cover backgrounds |
| Dark gray | `#404040` | Text 1 | Body text, header text, page number |
| Mid gray | `#595959` | Text 1 lighter | Key message next to the title, cover author/date, agenda item text |
| Card gray | `#DEDEDE` | Background 2 | Standard cards, grouping bands, gray slide background |
| Pale blue | `#DFE6EF` | Navy tint | Card fill for a second group of cards (e.g. one industry group vs another) |
| Panel gray | `#F2F2F2` | Background 2 lighter | Large text panels, outlined cards |
| Neutral gray | `#929496` | | De-emphasized group band ("not a focus") |
| Light blue | `#4AA8DC` | Accent | Quote layout background, light-blue group bar, rare highlight |
| Status blue | `#CDEBF8` | Light blue tint | Status / category band |
| Status green | `#9ED062` | (non-theme) | Status / category band ("Recruit", "Go") |
| Check green | `#2FA84F` | (non-theme) | Check-circle status markers only |
| White | `#FFFFFF` | Background 1 | Slide background, text on navy, cards on gray slides |

Rules:
- Navy is the only strong color. Most slides use navy, grays and white only.
- Emphasis = navy fill with white text, or a 1 pt navy outline on white.
- Two card fills (gray and pale blue) may separate two groups on one slide. Always name the groups with a text label too.
- Colored status bands group cards by category. Keep text on them dark and bold, and always label them so color never carries meaning alone.
- Logos keep their own brand colors. Nothing else adds new colors.

## 3. Typography

- **Headings: Source Sans Pro Regular.**
- **Body: Source Sans Pro Regular.**
- Bold (Source Sans Pro Bold or Semibold) only for short lead-ins, key terms and key figures inside body text ("**300+** ERNIans", "**Offices** in ..."), and for status band labels.
- Titles are never bold. Size and navy color create the hierarchy.
- Fallback: Source Sans 3 (Google Fonts version), then Arial.

| Element | pt | px (1920) | Color | Notes |
|---|---|---|---|---|
| Cover title | 44 | 88 | Navy | Left half, vertically centered |
| Slide title | 40 to 44 | 80 to 88 | Navy | 1 to 2 lines, line spacing 0.9 |
| Title subtitle (second line) | 24 to 28 | 48 to 56 | Navy | Directly under title, e.g. "An SDLC Definition" |
| Key message (right column) | 20 to 24 | 40 to 48 | Mid gray | Full sentence ending in a period, up to 5 lines |
| Intro paragraph (full width) | 18 to 20 | 36 to 40 | Dark gray | Under the title when there is no right column |
| Agenda item | 18 | 36 | Mid gray | Next to a large navy number |
| Icon list row text | 16 | 32 | Dark gray | Bold lead-in word or figure |
| Group label under cards | 16 | 32 | Dark gray | Centered under a thin navy rule |
| Column / card heading | 18 to 20 | 36 to 40 | Navy | Regular weight |
| Header bar text | 18 to 20 | 36 to 40 | White on navy | Centered |
| Large number (01, 02 ...) | 28 to 32 | 56 to 64 | Navy | Index and number-text layouts |
| Body text and bullets | 14 | 28 | Dark gray | Default |
| Dense card body | 12 | 24 | Dark gray | Minimum size |
| Header "Better ask ERNI", page number | 8 to 9 | 16 to 18 | Dark gray | From the master. HTML builds: 24 px |

Spacing: body line spacing 1.0 to 1.1 (ERNI text is set tight), with about half a line between paragraphs and between bullets.

Language: ERNI copy uses **British English** spelling (customised, visualisation, optimisation, centres).

## 4. Page frame

Measured from the template (13.333 x 7.5 in):

- **Header (mandatory):** every normal slide shows "Better ask ERNI" at top left: Source Sans Pro Regular, 9 pt, dark gray `#404040` (white on navy backgrounds), text box at x 0.37 in, y 0.42 in, about 3 x 0.3 in, no other text in it. Only Cover and Back Cover slides go without it. On half-image slides it moves to x 6.85 in. Page number at top right on the same line (right edge 0.37 in from the slide edge).
- **How to guarantee it:** with the template it comes from the layout, so never delete it. When building without the template, put it on the slide master or layout of the generated file (not as a loose text box per slide), so no slide can miss it. When a slide will be pasted into another deck, keep it on the layout so it does not duplicate the destination header.
- **Side margins:** about 0.37 in (53 px) left and right.
- **Title:** top at about 1.1 in (160 px), left aligned to the margin.
- **Right column** (key message): starts at about 6.75 in (970 px) and runs to the right margin. Its top aligns with the title top.
- **Content zone:** from about 3.0 in (430 px) down to about 6.8 in (980 px). Leave about 0.5 in clear at the bottom.
- **Half-image layouts:** a full-bleed photo fills the left half (0 to about 6.6 in, top to bottom, no margin). Header, title and content all move to start at about 6.85 in.
- Background is white, except gray-background layouts, section, quote and back-cover layouts.

## 5. Signature layout: title left, message right

Most content slides open the same way:

- Navy title (optionally with a navy subtitle line) in the left half.
- The key message as a gray sentence in the right half, top-aligned with the title. It can carry facts ("Born in 1994, ERNI is ...").
- Content (cards, columns, panels, icon grid) across the full width in the lower half.

Titles are either a topic name in Title Case ("Collaboration Models", "Practices and Services") or a short claim in sentence case ("Leaders in complex and regulated industries"). Sections may be numbered ("3. ..."). When the content needs the full slide (icon grids), drop the right-hand message and keep only the title.

## 6. Icons

- Navy **line icons** (outline style, uniform stroke weight, no fills or multiple colors), all from one consistent set on a slide.
- Source: the template's icons when available, otherwise **Tabler Icons outline** recoloured to navy (section 11).
- Size: about 0.7 in in cards and icon grids, about 0.5 in in icon lists.
- Placement: top left inside cards (heading directly below); centered above the heading in icon grids; left of the text in icon lists, vertically centered on the row.
- An icon supports a heading, it never replaces one.
- Some older slides use solid navy icons (gear, AI chip). Do not mix solid and line icons on one slide.

## 7. Content patterns

**Cards**

1. **Icon card row** (Info Layout 10): 3 to 5 equal cards with wide gaps (about 0.4 to 0.5 in). Navy icon top left, navy heading, then optional short paragraphs in dark gray. Square corners, no border. Cards may be tall with only icon and heading; the empty space is intended.
2. **White cards on a gray slide:** slide background `#DEDEDE`, white cards, same inner structure. Use to vary rhythm in a long deck (e.g. collaboration models).
3. **Highlighted card:** navy fill with white text to mark the current or recommended item ("Now").
4. **Grouped cards with gradient bars:** two groups of cards side by side (e.g. pale blue cards vs gray cards). Under each group: a thin navy rule, a centered dark-gray group label ("Mission-Critical Systems", "Health & Patients"), then a thick gradient bar. Left group bar fades from navy to transparent, right group bar from transparent to light blue. Take the bars from the template.
5. **Status header bands:** colored bands (status blue, status green, neutral gray) spanning groups of cards, with a bold dark label and 1 to 3 short lines (owner, seniority, location). Cards below are `#F2F2F2` with a thin dark outline.
6. **Grouping band and progression wedge:** a `#DEDEDE` strip under several cards with a centered navy label ("AI-Enabled"); a navy triangle ramp above a card row, thin on the left and tall on the right, with a white label at its right end ("AI Integration").

**Lists and grids**

7. **Icon grid without cards:** 2 rows x 4 columns on white. Each cell: centered navy line icon, centered navy heading, then 3 to 4 short bullets (navy dots, dark-gray text). Title only, no right message. Use for practices, services or capability overviews.
8. **Icon list:** 4 to 6 rows, each with a navy line icon on the left and one sentence on the right, starting with a bold lead-in word or figure ("**95%** with Academic Background."). Rows evenly spaced. Often on the right half next to a photo.
9. **Three columns with dividers** (Info Layout 2a): centered navy column headings, thin navy vertical lines between columns, bullets with bold key phrases. One column can hold a logo cloud.
10. **Numbered rows / agenda:** large navy numbers (28 to 32 pt) with mid-gray item text (18 pt), each row separated by a thin dark horizontal rule spanning the column.
11. **Process chips:** rectangular outlined chips (1 to 2 pt navy border) joined by navy arrows. The last or current step is filled navy.

**Text compositions**

12. **Two text panels:** a full-width intro paragraph under the title, then two `#F2F2F2` panels. Each panel has a bold dark-gray heading (not navy), then bullets or paragraphs.
13. **Canvas boxes:** navy header bars with white centered text above white boxes with a 1 pt navy outline holding numbered lists. Use for worksheets such as a value proposition canvas.
14. **Statement slide:** title only, then a centered text block about 70 percent of the slide width, 18 to 20 pt, with bold lead-ins. Optionally a row of logos below.
15. **Navy layer stack:** full-width horizontal blocks with a navy number, a name column and a description. Emphasis block solid navy, boundary block navy-outlined white, the rest `#DEDEDE`.
16. **Closing punchline:** the Punchline layout, or a full-width navy band with a white sentence and the key phrase in bold.

**Half-image slides**

17. **Photo + icon list:** a real photo (people, office, work in progress) full-bleed on the left half; title and an icon list (pattern 8) on the right half. Use for company or team facts.
18. **Agenda:** template image full-bleed on the left half; "Agenda" title at top right; numbered rows (pattern 10) in the lower part of the right half.

Lines: dividers, rules and outlines are thin (0.75 to 1 pt) and navy, except agenda rules which are thin dark gray. Lists: round bullets in navy, text in dark gray. Numbered lists use "1." style with a hanging indent.

## 8. Choosing a pattern

| Content | Pattern |
|---|---|
| 3 to 5 categories with a short description | Icon card row (1), or white cards on gray (2) |
| Categories that fall into two families | Grouped cards with gradient bars (4) |
| 6 to 8 capabilities, each with a few bullets | Icon grid (7) |
| Company or team facts and figures | Photo + icon list (17) |
| Stages with increasing intensity | Progression wedge (6) or process chips (11) |
| Ownership or status per group | Status header bands (5) |
| Argument in two or three sentences | Statement slide (14) |
| Layered architecture | Navy layer stack (15) |

## 9. Template layout catalogue

Pick the template layout by name instead of building the structure by hand:

| Need | Layout(s) |
|---|---|
| Title slide with image | Cover Layout 1 (logo top left, title left, author/date bottom left, full-bleed image right half) |
| Title slide, no image | Cover Layout 2, 3 |
| Agenda / index | Index Layout 1a to 1d (image left, numbered list right), Index Layout 2a to 2d (full-width numbered list) |
| Section divider | Section Layout 1, 2 (navy background, white text); Section Layout 3, 4 (white) |
| 2 to 4 points with icons over lines | Info Layout 1a to 1c (horizontal lines), 2a to 2c (vertical lines) |
| Title, subtitle and text blocks | Info Layout 3a to 3c |
| Numbered points | Info Layout 4a to 4c (Number-Text) |
| Text plus large box | Info Layout 5a to 5d (Text Right / Text Left) |
| Photo and text, photo + icon list | Info Layout Image and Text 6a, 6b |
| Bullet slide | Info Layout 7a, 7b |
| Subtitle plus icon list on the right | Info Layout 8a to 8e |
| Full-width graphic | Info Layout 9a, 9b; 9c on gray |
| Four gray cards | Info Layout 10 |
| Contract / dense text | Info Layout Contract |
| Side-by-side comparison | Info Layout Comparison |
| Chart with explanation | Chart Layout 1a, 1b, 2a, 2b, 3 |
| Case study | Case Study Layout 1a, 1b |
| Process / timeline, cards on gray | Flow Layout 1a to 1c (numbers), 2a to 2c (icons), 3a to 3c (gray cards over a line), 4a to 4c (white cards on gray), 5, 6 |
| Image-backed tiles | Containers Layout |
| Team / people | People Layout 1 to 3 |
| Single strong statement | Punchline |
| Quote | Quote Layout (light blue background) |
| Closing slide | Back Cover 1 to 3 (navy, ERNI "e" mark, "Swiss Software Engineering", "Better ask ERNI") |

Deck skeleton: Cover, Agenda, then per chapter a Section slide followed by Info / Flow / Chart slides, optional Punchline, and a Back Cover to close.

## 10. Content rules

- Title names the topic or states a short claim; the key message carries the point as a full sentence.
- Body: short phrases, parallel grammar, bold only the 1 to 4 words or the figure that matters.
- British English spelling. No em dashes in slide text.
- Fill about 70 to 80 percent of the content zone. If a slide overflows, split it rather than shrinking text below 12 pt.
- Keep repeated elements (title, message, card row) in the same position from slide to slide.
- Add short speaker notes to each slide.
- Do not invent figures, references or quotes. Use bracketed placeholders like `[__]` for missing data.

## 11. Assets: where to get them

No setup step and no local asset folder. Each asset has a fixed source that a build can use directly.

| Asset | Source | How to use it |
|---|---|---|
| ERNI logo (shield "e" + wordmark), color | `https://www.betterask.erni/wp-content/uploads/2023/09/ERNI_logo_color.png` | Download at build time and place it as an image. Keep its aspect ratio; about 2.4 in wide on covers, top left at the margin |
| White "e" mark, cover and agenda photos | Only in the ERNI template | Use the template's Cover, Index and Back Cover layouts. Without the template, leave a picture placeholder on the image half |
| Team / office photos | Your own photos, or images on betterask.erni pages | Full-bleed on the left half (pattern 17) |
| Navy line icons | **Tabler Icons outline** (MIT, uniform 2 px stroke, closest match to the template icons), e.g. via `react-icons/tb` or npm `@tabler/icons` | Render as PNG/SVG in navy `#17366F`, about 0.7 in in cards and 0.5 in in lists |
| Check-circle status marker | Tabler `circle-check-filled` | Render in check green `#2FA84F` |
| Gradient group bars | Generated at build time | A thick bar (about 0.15 in high) with a gradient fill: navy `#17366F` solid, fading to fully transparent over the last 30 % (left group); light blue `#4AA8DC` fading in from transparent over the first 35 %, then solid (right group). Use the shape's gradient fill with transparency stops, or a generated PNG |

Notes:
- **Prefer the template** when it is available: its logo, photos and icons are higher quality than any fallback.
- **Website URLs can change.** If the logo URL stops working, open betterask.erni and take the new logo URL from the page header.
- **Sandboxed builders** (e.g. Claude chat) may not be able to download from betterask.erni. In that case, upload the logo PNG at the start of the session.
- Use the ERNI logo only as ERNI uses it: on covers, back covers and the template's own positions, never stretched, recoloured or placed on busy photo areas.
- **Icons:** one set per slide, outline style only, recoloured to navy. Never mix with filled icons from another set.
- **Third-party tool and customer logos** (dbt, Snowflake, AWS ...) are not part of this kit; add them from each vendor's official brand page.

## 12. Pre-delivery checklist

- [ ] "Better ask ERNI" top left on every slide except Cover and Back Cover; page number top right.
- [ ] Titles navy, Source Sans Pro Regular, not bold; key message in mid gray on the right where the layout has one.
- [ ] Only theme colours from section 2; navy is the only strong colour.
- [ ] Icons from one outline set, all navy, same size within a row.
- [ ] ERNI logo from the template or the official URL in section 11, never redrawn; photos real, not substitutes.
- [ ] Nothing below 12 pt; nothing overlapping; content inside the margins.
- [ ] British English, no em dashes, speaker notes on every slide.