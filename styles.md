## Overall Aesthetic
A minimalist, Swiss-design-inspired interface. Think Helvetica-era Swiss
typography meets a technical/utilitarian dashboard: high-contrast black and
white, razor-sharp geometric shapes, generous whitespace, and a single
accent color used sparingly. No gradients, no soft shadows, no rounded
corners anywhere.

## Colors
- Background: `#FFFFFF` (pure white)
- Primary text: `#1A1A1A` (near-black, not pure black)
- Secondary/muted text: `#6B7280` (gray-500)
- Borders: `#000000` (pure black), always solid
- Accent (sparingly, for icons/highlights/success states): `#0A8C3A`
  ("Swiss green")
- Primary button: black background (`#000000`), white text/icon
- Secondary button: white background, black text/icon, black border

## Typography
- Font family: system sans-serif stack —
  `"Helvetica Neue", Helvetica, Arial, sans-serif` (no custom webfont)
- Headings: bold (700 weight), tight letter-spacing (`tracking-tight`)
    - H1 example: 36px / 700 weight / `#1A1A1A`
- Body/subtext: regular weight (400), small size (14px), muted gray
- Stat numbers: bold (700), larger size (24px), tight line-height
  (`leading-none`)
- Small labels (e.g. "Games Played"): 12px, regular weight, muted gray
- Section labels (e.g. "GAMES LAST 7 DAYS"): small, uppercase, muted gray

## Shape Language
- **Border-radius: 0px everywhere.** No rounded corners on buttons, cards,
  icon containers, or inputs — sharp 90° corners throughout.
- **Borders: 2px solid black** on cards, buttons (secondary), icon boxes,
  and containers. Borders are structural — they *are* the design, not a
  decoration.
- **No box-shadows.** Depth comes from borders and contrast, never blur.
- Icon containers: square, fixed size (e.g. 64x64px or 40x40px), centered
  icon, 2px black border, transparent or light-gray (`gray-50`) background.

## Components
- **Primary button:** full-width, black background, white text, white
  icon, 16px/500-weight label, generous padding (16px vertical), 2px
  black border (same as fill), no radius.
- **Secondary button:** identical shape/sizing to primary, but inverted —
  white background, black text/border.
- **Cards/stat boxes:** white background, 2px black border, 0 radius,
  16px padding, flex layout (icon + number + label), no shadow.
- **Icons:** outline-style icon set (Lucide), 2px stroke weight, black by
  default, green (`#0A8C3A`) for special/branded icons (e.g. a globe
  logo mark).
- **Bar chart bars:** solid green (`#0A8C3A`) fill, sharp rectangular
  bars, no rounding, thin/muted axis labels below.

## Layout
- Centered single-column layout, narrow max-width (~400px card stack)
- Generous vertical spacing between elements (16–24px gaps)
- Icon-in-a-box sits above the H1, which sits above the subtext — all
  centered
- Buttons and cards stack vertically, full-width within the container

## Voice / Content Style
- Short, plain, functional copy — no marketing fluff
  (e.g. "Race through Wikipedia. First to the finish wins.")
- Utilitarian microcopy for state (e.g. "No account needed. Just pick a
  name and play.")

## One-line Summary for Prompting
> A stark black-and-white Swiss-design interface: zero border-radius,
> 2px solid black borders everywhere, no shadows, Helvetica/system
> sans-serif, bold tight headings, muted gray secondary text, and a
> single Swiss-green (#0A8C3A) accent color used only for icons and
> data highlights.
