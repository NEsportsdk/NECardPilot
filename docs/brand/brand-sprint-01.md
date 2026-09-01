# Vallective Brand Sprint 01

Status: Direction A with editorial warmth from B approved. V2 Open V is the
approved mastermark. Its product, PWA, metadata and pilot-email integration has
been built, validated and approved for production release.

This document deliberately lives outside the product implementation. None of
the concepts below changes application code, production assets, Supabase,
Vercel or the existing Vallective experience.

## Brand platform

### Brand idea

**Collector intelligence.**

Vallective turns a collection from a stack of cards into structured knowledge:
what the collector owns, what it is worth, what it cost, how it performs and
what deserves attention next.

The name can carry three connected meanings:

- **Value** — financial clarity without reducing collecting to speculation.
- **Collective** — the knowledge, signals and culture surrounding collectors.
- **Collection intelligence** — the product layer that organizes and explains
  the collection.

### Primary audience

International sports-card collectors, initially NBA-first, who combine one or
more of these behaviours:

- maintain a personal collection (PC);
- buy, grade and sell cards;
- track cost basis, value and profit/loss;
- want faster identification and better collection decisions.

### Brand personality

- intelligent, not technical for its own sake;
- confident, not loud;
- premium, not elitist;
- collector-native, not corporate;
- editorial and human, not a sterile database;
- careful with value claims and transparent about uncertainty.

### Brand promise

Vallective gives collectors one trustworthy place to understand and manage the
full life of every card.

### Messaging hierarchy

1. **Descriptor:** `Collector intelligence`
2. **Recommended master pay-off:** `Collect what matters. Know what it's worth.`
3. **Social/editorial expression:** `Know what you own. Know what it's worth.`
4. **Product proof:** `Scan. Organize. Value. Grade. Sell.`

The recommended master pay-off is already present in Vallective's metadata and
Open Graph asset. It balances the emotional reason to collect with the rational
reason to use the product.

## Valerie's role

Valerie is Vallective's fictional adult digital host and the recurring human
entry point for social content. She is not the logo and should not become the
whole brand.

Her role is to:

- attract attention and make the brand recognisable on Instagram;
- host card opinions, explainers, polls and product demonstrations;
- speak collector-to-collector in a concise, knowledgeable voice;
- lead followers from useful content to the Vallective waitlist.

Valerie must always be described transparently as a digital host. Content must
not invent personal ownership stories, imply that she is a real independent
collector or rely on sexualised presentation instead of collector value.

Her existing approved profile portrait and Instagram launch plan remain outside
the public repository until their publication and source-control treatment are
explicitly approved.

## Direction A — Collector Intelligence

**Recommendation: strongest master-brand direction.**

An evolution of the identity already built into the product. The V is formed by
two card silhouettes and refined into a simpler, more ownable signal. The final
mark should remove tiny illustrative details and work perfectly in one colour.

### Meaning

- two cards create the V;
- negative space suggests scanning and comparison;
- the paired forms express PC plus inventory, emotion plus value, and collector
  plus intelligence;
- the V remains recognisable in the current app icon.

### Palette

| Role | Name | Hex |
| --- | --- | --- |
| Foundation | Vallective Void | `#07090D` |
| Surface | Carbon | `#10141C` |
| Primary | Vallective Violet | `#7867FF` |
| Highlight | Signal Lavender | `#A99BFF` |
| Positive signal | Mint | `#55D6A2` |
| Text | Porcelain | `#F5F7FB` |

### Typography

Retain Geist Sans and Geist Mono for version one. They are already integrated,
perform well in the product and support a precise international technology
identity. The Vallective wordmark should be optically customised rather than
introduced as an unrelated decorative font.

### Pay-off

`Collect what matters. Know what it's worth.`

### Strengths

- preserves recognition and avoids an expensive visual reset;
- works across product, PWA icon, Instagram and email;
- differentiates through the mark and product promise rather than decoration;
- pairs naturally with Valerie's warm editorial photography.

### Watch-outs

- the final mark must not contain a tiny chart or scanner detail that disappears
  at favicon size;
- violet must remain controlled to avoid a generic AI/SaaS appearance.

## Direction B — Vault & Value

A warmer, more exclusive collector identity. Two slab-like card edges form a V
around a protected central card or vault shape.

### Palette

| Role | Name | Hex |
| --- | --- | --- |
| Foundation | Gallery Black | `#0D0D12` |
| Text | Warm Ivory | `#F5F0E6` |
| Primary | Collector Gold | `#C5A46D` |
| Accent | Deep Aubergine | `#351436` |

### Pay-off

`Know what you own.`

### Strengths

- highly premium and visually compatible with graded cards and display cases;
- warm gold lighting connects naturally with Valerie's portrait style;
- strong for high-end card showcases and physical merchandise.

### Watch-outs

- can resemble wealth management, a vault service or a jewellery brand;
- gold reproduction is inconsistent across screens and inexpensive print;
- moving the app from violet to gold would create unnecessary implementation
  cost and weaken existing recognition.

## Direction C — Culture Signal

A more energetic social-first identity. Stacked card edges create a V that also
suggests momentum, conversation and market signals.

### Palette

| Role | Name | Hex |
| --- | --- | --- |
| Foundation | Midnight Court | `#071532` |
| Primary | Ultraviolet | `#582BFF` |
| Secondary | Ice Blue | `#35C4F1` |
| Signal | Coral | `#FF625A` |
| Text | Bright White | `#F8FAFF` |

### Pay-off

`See the card. Know the play.`

### Strengths

- immediate energy in Reels, carousels and motion graphics;
- creates a clear system for polls, comparisons and market alerts;
- feels native to modern sports media.

### Watch-outs

- risks looking like an esports, betting or generic sports-tech brand;
- less timeless for a collection platform holding financial history;
- the multi-colour mark is harder to reproduce consistently.

## Recommendation

Choose **Direction A — Collector Intelligence** as the master identity.

Refine the current V into a simpler two-card monogram and preserve the existing
dark/violet product foundation. Borrow warmth from Direction B through
photography, lighting and occasional editorial accents — not as a second logo
palette. Use the pace and directness of Direction C in social layouts and motion,
without importing its full colour system.

This creates one coherent system:

- Vallective owns the intelligent dark/violet product universe;
- Valerie brings warmth, personality and attention;
- real cards remain the most colourful objects in the content;
- data and values are presented with calm authority;
- the identity can mature without redesigning the application.

## Logo requirements after direction approval

The selected direction should be rebuilt as deterministic vector artwork, not
used directly from the raster concept exploration. The final logo package must
include:

- primary horizontal wordmark;
- standalone V mark;
- one-colour black, white and reversed versions;
- app icon and maskable icon;
- favicon and social-avatar crops;
- minimum-size and clear-space rules;
- light and dark background rules;
- SVG masters plus PNG exports.

The final V must pass recognisability checks at 16, 24, 32, 48 and 192 pixels.

## Instagram foundation carried forward

- Position: English-language, NBA-first collector media with a product beneath
  it.
- Mix: approximately 90% NBA and 10% soccer in card-led content.
- Host: Valerie, explicitly described as Vallective's digital host.
- Highlights: `START`, `CARDS`, `MARKET`, `APP`, `WAITLIST`.
- Content mix: 45% entertainment/opinion, 25% education, 20% Vallective/build,
  10% direct conversion.
- Primary CTA before launch: join the Vallective waitlist.

## Visual exploration provenance

Three preview-only direction boards were generated with the built-in image
generation tool. They are intentionally not production logo files and have not
been copied into the public project.

Prompt summaries:

1. **Signal V:** two collector-card silhouettes forming a minimal V with a
   restrained data/scan cue; obsidian, violet, porcelain and mint.
2. **Vault & Value:** two slab-like card edges creating a V around a protected
   central-card negative space; charcoal, ivory, champagne and aubergine.
3. **Culture Signal:** three stacked card-edge forms creating a bold V and a
   sense of momentum; midnight, ultraviolet, ice blue and coral.

All three prompts prohibited third-party sports logos, trading-card trademarks,
watermarks, mascots and direct imitation of existing brands.

## Decision gate

The approved direction is:

- **A — Collector Intelligence as the master identity**;
- **selected editorial warmth from B — Vault & Value**;
- no gold replacement of the core violet product palette.

The first generated A mark was judged too heavy and detailed and remains concept
evidence only. The simplified **V2 Open V** has now passed the 16–96 px
recognisability test and is the approved mastermark direction.

The vector masters, digital icons, social avatar and PNG exports live in
`docs/brand/logo-v2/`. The complete package and its product integration are
approved for production release. Git and Vercel retain the release record.
