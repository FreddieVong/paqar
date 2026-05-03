# Paqar — Design System & Visual Direction

> Last updated: 2026-05-04  
> Status: **Approved** — ready for implementation

---

## 1. Brand Direction

**Name:** Paqar (stylised respelling of "pakar" — Malay for "expert")  
**Tagline:** Pakar yang jaga anda sebagai pemilik kenderaan Malaysia.  
**Positioning:** Premium Local Utility — the easiest, most trustworthy place in Malaysia to check saman and blacklist.

**Design references:**
- Simple like Grab — the tool is immediately obvious
- Trustworthy like Bjak — clean, no-nonsense, Malaysian-first
- Polished like Apple — generous whitespace, intentional every pixel
- Local enough for Malaysian users aged 25–40

**The "wow" comes from:** clarity, spacing, typography, confident colour use, zero confusion — not from decoration.

---

## 2. Design Principles

1. **Tool first, marketing second.** The landing page IS the product. The hero section contains a fully functional checking card, not a screenshot of one.
2. **Zero ambiguity.** Green means safe. Red means act now. Grey means unavailable. No user should need to read a label twice.
3. **Honest.** Never claim to be official. Never oversell. Never hide limitations.
4. **Mobile-first, always.** Every component is designed for a 390px screen first. Desktop layout is an enhancement, not the primary.
5. **Generous space.** When in doubt, add more whitespace. Crowded = cheap. Spacious = premium.
6. **Bahasa Malaysia as primary UI language.** Short, clear, everyday words. No technical or legal jargon.

---

## 3. Visual System

### 3.1 Colour Palette

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#064E4A` | Brand, buttons, nav accent, step numbers, links |
| `primary-dark` | `#053D3A` | Button hover state |
| `accent` | `#FACC15` | Sparingly — trust dots in CTA, logo inner mark, highlight moments |
| `background` | `#F8FAF7` | Page background (slightly warm off-white, not pure white) |
| `surface` | `#FFFFFF` | Cards, nav, hero section |
| `text` | `#111827` | All primary text |
| `muted` | `#6B7280` | Secondary text, labels, subheadlines |
| `border` | `#E5E7EB` | All borders, dividers |
| `success` | `#16A34A` | Clear result state — dot, card background tint, badge |
| `danger` | `#DC2626` | Hit/saman result state — dot, card background tint, badge |

**Rules:**
- Accent (`#FACC15`) used maximum 2–3 times per page. Never as a background.
- Never use gradients.
- Never use purple, glassmorphism, or neon.
- Status colours (success/danger) are reserved exclusively for result states. Do not use green for generic CTAs.

### 3.2 Typography

**Font pair:** Plus Jakarta Sans (headings + UI) + DM Sans (body)

```
Headline / Display:   Plus Jakarta Sans 800  |  30–40px  |  tracking −3%  |  lh 1.08–1.1
Section title:        Plus Jakarta Sans 800  |  22–26px  |  tracking −2%  |  lh 1.2
Card title / UI:      Plus Jakarta Sans 700  |  14–16px
Label caps:           Plus Jakarta Sans 700  |  11px     |  uppercase     |  tracking +8%
Body:                 DM Sans 400            |  14–15px  |  lh 1.6
Small / caption:      DM Sans 400            |  12–13px  |  color muted
Button:               Plus Jakarta Sans 700–800  |  14–16px
```

**Rules:**
- Headlines always Plus Jakarta Sans 800, never lighter
- Body copy always DM Sans — never Jakarta Sans for long prose
- Plate number input: Plus Jakarta Sans 800, 20–22px, letter-spacing +12%, centred
- No italic text in UI — use weight for emphasis

### 3.3 Spacing System

Base unit: **4px**

| Scale | Value | Common use |
|---|---|---|
| xs | 4px | Icon padding, tight gaps |
| sm | 8px | Between label and input |
| md | 12–16px | Between form fields |
| lg | 20–24px | Card padding, section gaps |
| xl | 32–40px | Section vertical padding (mobile) |
| 2xl | 48–64px | Section vertical padding (desktop) |

### 3.4 Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius-tag` | 100px | Badges, pills, eyebrow labels |
| `radius-btn` | 12px | All buttons |
| `radius-input` | 12px | All inputs |
| `radius-card` | 16px | Standard cards, result cards |
| `radius-hero-card` | 20px | The main checking card in hero |
| `radius-logo` | 9px | Logo icon block |
| `radius-step-num` | 12px | Step number squares |

### 3.5 Button System

**Primary (Semak Sekarang):**
- Background: `#064E4A` → hover `#053D3A` + `translateY(-1px)` + `box-shadow: 0 6px 20px rgba(6,78,74,.25)`
- Text: white, Plus Jakarta Sans 700–800
- Height: 48px (14px padding top/bottom)
- Border-radius: 12–14px
- Min tap target: 48px height

**Ghost / Secondary (Lihat Cara Ia Berfungsi):**
- Background: transparent
- Border: 1.5px `#E5E7EB`
- Text: `#064E4A`, Plus Jakarta Sans 600
- Same height as primary

**White on dark (Final CTA):**
- Background: `#FFFFFF`
- Text: `#064E4A`
- Same dimensions, used only on teal backgrounds

**Accent (rare):**
- Background: `#FACC15`
- Text: `#111827`
- Maximum once per page

### 3.6 Input System

**Standard:**
- Background: `#F9FAFB`
- Border: `1.5px solid #E5E7EB`
- Focus: `border-color: #064E4A` + `box-shadow: 0 0 0 3px rgba(6,78,74,.1)`
- Border-radius: 12px
- Padding: 14px 16px
- Font: Plus Jakarta Sans 600, 16px
- Label: 11px uppercase tracking caps above, 6px gap

**Plate number (hero):**
- Same as above PLUS:
- Font: Plus Jakarta Sans 800, 20–22px
- Letter-spacing: +12%
- Text-align: centre
- Text-transform: uppercase
- Placeholder in muted: "contoh: WVP 1234"

### 3.7 Card System

**Result card (check results):**
- Border-radius: 12px
- Border: 1.5px solid
- Clear: `bg #F0FDF4`, `border #BBF7D0`, label text `#15803D`
- Hit: `bg #FEF2F2`, `border #FECACA`, label text `#B91C1C`
- Unavailable: `bg #F9FAFB`, `border #E5E7EB`, text muted
- Status dot: 10px circle, right-aligned, colour matches state
- Label: 10px uppercase tracking
- Value: Plus Jakarta Sans 700, 14px

**Checking card (hero):**
- Background: white
- Border: `1.5px solid #E5E7EB`
- Border-radius: 20px
- Shadow: `0 4px 24px rgba(0,0,0,.07)`
- Desktop shadow: `0 8px 40px rgba(0,0,0,.1)`
- Contains: plate input, IC input, primary button, trust strip

**Feature / trust cards:**
- Background: white
- Border: `1.5px solid #E5E7EB`
- Border-radius: 16px
- No shadow on these — shadow is reserved for the hero card

### 3.8 Status Badge System

| State | Background | Text colour | Usage |
|---|---|---|---|
| Clear / Tersedia | `#DCFCE7` | `#15803D` | Available feature, clear result |
| Hit / Ada Isu | `#FEE2E2` | `#B91C1C` | Saman/blacklist hit |
| Warning / Perhatian | `#FEF9C3` | `#854D0E` | Needs attention |
| Coming soon | `#F3F4F6` | `#6B7280` | Future features |
| In progress | `#F3F4F6` | `#6B7280` | Checking state |

All badges: Plus Jakarta Sans 700, 11px, 100px border-radius, 4px/10px padding.

### 3.9 Icon Style

- Emoji icons for feature items and trust cards — approachable, no custom illustration required
- Lucide React for UI icons (chevrons, close, check) — consistent, clean
- No complex illustrations
- No stock imagery of any kind
- Logo icon: solid teal square with rounded corners, yellow inner mark

### 3.10 Micro-interactions

| Element | Interaction |
|---|---|
| Primary button | `hover: translateY(-1px) + shadow` · `active: scale(.98)` |
| Input field | `focus: teal border + soft ring` |
| Result cards | `opacity 0 → 1 + translateY(8px → 0)` as each card appears (staggered 150ms) |
| Progress bar | `width: 0% → N%` smooth, teal fill |
| FAQ item | `chevron rotates 180°` on open, body animates height |
| Nav CTA | `hover: border-color teal` |

### 3.11 Loading / Empty States

**Result card (pending):**
- Background: `#F9FAFB`, border: `#E5E7EB`
- Value text: "Sedang disemak…" in muted
- No skeleton shimmer — Paqar shows live cards as they resolve, not skeleton then all at once

**Error state (source unavailable):**
- Grey card, muted text: "Tidak dapat disemak buat masa ini"
- Never silently omitted — always shown so user knows coverage

**Empty input:**
- Placeholder text centred, muted
- No pre-filled data

---

## 4. Landing Page Structure

```
┌─────────────────────────────────┐
│  NAV                            │
│  Logo left · Log Masuk right    │
├─────────────────────────────────┤
│  HERO                           │
│  Eyebrow pill (Percuma)         │
│  H1: Semak Saman & Blacklist    │
│  Subheadline                    │
│  ┌─────────────────────────┐    │
│  │  CHECKING CARD          │    │
│  │  Plate input            │    │
│  │  IC input               │    │
│  │  [Semak Sekarang →]     │    │
│  │  Trust strip (3 items)  │    │
│  └─────────────────────────┘    │
├─────────────────────────────────┤
│  APA YANG BOLEH DISEMAK         │
│  3 feature cards (column/grid)  │
│  Saman · Blacklist · Dokumen    │
├─────────────────────────────────┤
│  CARA IA BERFUNGSI              │
│  3 numbered steps               │
│  Connector line between them    │
├─────────────────────────────────┤
│  KENAPA PAQAR                   │
│  3 trust cards: Pantas/Jelas/   │
│  Selamat                        │
├─────────────────────────────────┤
│  SOALAN LAZIM                   │
│  4 FAQ items (accordion)        │
├─────────────────────────────────┤
│  FINAL CTA                      │
│  Dark teal bg · white button    │
│  Yellow accent dots in copy     │
├─────────────────────────────────┤
│  FOOTER                         │
│  Disclaimer (bukan rasmi)       │
│  Privacy · Terms · Contact      │
└─────────────────────────────────┘
```

**Desktop layout changes:**
- Hero: 2-column grid (copy left, checking card right)
- Nav: adds "Cara Ia Berfungsi" and "FAQ" text links
- Features: 3-column grid
- Trust cards: row layout
- Max content width: 1100px, centred

---

## 5. Component Rules

### CheckForm (hero card)
- Plate input always centred, uppercase, large tracking
- IC input left-aligned, standard size
- CTA button full-width inside card
- Trust strip beneath button — Percuma · Tanpa daftar · 60 saat
- Card shadow differentiates it from section background

### ResultCard
- Status determined by `result.status`
- Label: source name in uppercase tracking
- Value: human-readable status text in BM where possible
- Dot: right-aligned colour indicator
- Cards animate in sequentially as sources resolve

### ResultsStream
- Progress bar at top: teal fill, "X daripada 7" counter
- "Menyemak 7 sumber…" label while running → "Semakan selesai" when complete
- Cards appear in fixed order: PDRM → JPJ → AES → Majlis → Imigresen → LHDN → PTPTN
- "Save & create account" CTA uses dashed teal border — distinct from result cards

### Navigation
- Sticky top, white bg, 1px bottom border
- Logo: teal icon block + "Paqar" wordmark
- Right: "Log Masuk" ghost button (not signed in) or user avatar (signed in)
- Mobile: no inline nav links — hamburger deferred to later wave

### Status Eyebrow (hero)
- Green pill: "Percuma · Tanpa daftar akaun"
- Success green — signals "this is safe to start"

---

## 6. Why This Design Will Feel World-Class

**1. The page IS the product.**  
Most utility apps have a marketing page that describes the tool, then a separate app. Paqar's hero IS the tool — the checking card is live and functional from the first pixel. This is what Stripe did with their payment demos. Users know immediately what Paqar does because they can do it right there.

**2. Typography does the heavy lifting.**  
Plus Jakarta Sans 800 at 38–40px with tight tracking (-3%) and a line-height of 1.08 creates a headline that feels like a product billboard, not a SaaS template. Combined with DM Sans body at 1.6 line-height, the reading experience is effortless.

**3. The checking card has real premium weight.**  
The 20px border-radius, deep shadow, oversized plate input with wide tracking, and full-width CTA button all signal "this is important, this is real." It looks like something Apple would build for a government service.

**4. Colour is used with restraint.**  
The page is 90% `#F8FAF7`, `#FFFFFF`, and `#111827`. The dark teal (`#064E4A`) appears only where it matters most — logo, CTA button, step numbers, links. The yellow (`#FACC15`) appears exactly 3 times: logo inner mark, CTA copy accent dots, and nowhere else. Restraint = premium.

**5. Bahasa Malaysia without compromise.**  
Every label, headline, button, and FAQ is written in clean, everyday BM. Not translated English — written in BM from the start. This signals "we were built for you", not "we added a Malay translation."

**6. Zero confusion on results.**  
Green = selamat. Red = ada isu. Grey = tidak dapat disemak. Users aged 25–40, non-technical, checking in 60 seconds on their phone — they should never need to read anything twice. The colour system does all the communication.

**7. Trust is earned by honesty.**  
The footer disclaimer ("Perkhidmatan pihak ketiga · Bukan platform rasmi kerajaan"), the PDPA copy in the FAQ, and the "data disulitkan" trust strip all signal that Paqar is honest about what it is. This builds more trust than any claim of being "official."
