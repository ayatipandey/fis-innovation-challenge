# Perkly design system: "The Edit"

Perkly is presented as a calm lifestyle magazine about your own rewards. The benefit is the headline; the conditions are the copy beneath it, set large enough to read without squinting.

## Palette

| Token | Hex | Use |
|---|---|---|
| Ivory | `#F7F2E9` | Page ground |
| Paper | `#FFFCF6` | Raised surfaces: reward sheet, panels |
| Linen | `#EFE7DA` | Second surface: checkout, featured band |
| Stone | `#E1D6C4` / `#C9BAA3` | Borders and rules |
| Espresso | `#2B211B` | Text, selected chips, dark band |
| Ink 2 / Ink 3 | `#5C4F43` / `#716355` | Secondary and tertiary text (≥4.5:1 on ivory) |
| Forest | `#2F4A3B` | The one action color: Use Reward, primary buttons, focus, "why" reasons |
| Wine | `#6B2433` | Time pressure, warnings, "What is not valid" |
| Champagne | `#C6A971` | Hairlines and decoration only, never text |

A high-contrast mode darkens text, borders and actions. Text size scales 100% / 112.5% / 125%.

## Type

- **Bodoni Moda** (self-hosted variable font) for display only: headlines, reward benefits, greetings and large numerals. Never below about 20px.
- **Hanken Grotesk** for everything functional: UI, forms, conditions, numbers (tabular).

## Shape and depth

Radii follow hierarchy: sheets 28px, panels 20px, controls 12px, chips fully round. There are two shadows only: a soft lift for hovered actions, and a deep, soft sheet shadow for overlays.

## Principles

1. One bold move per screen: the benefit set as an editorial headline. Everything around it stays quiet.
2. Conditions are never fine print. What you get, what you pay, what's valid and what isn't each get a heading, sit at body size or larger, and are never hidden behind accordions.
3. Forest marks the single action that matters; wine marks deadlines and limits; nothing else is colored.
4. Demo and simulated states are always labeled in place.
5. Motion answers actions: sheet entry, favorite pop, rank reordering, and the confirmation stamp. It's off with reduced motion.
