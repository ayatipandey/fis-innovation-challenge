# Perkly design system: glass

Frosted panels over two soft color orbs on a calm paper background. One typeface, one ink, one action color per theme.

## Themes

| Theme | Background | Text | Action (text on it) | Orbs |
|---|---|---|---|---|
| Fresh Green (default) | `#F6F4EC` | `#012834`, secondary `#2C7A24` | `#4BCD3E` (`#012834`) | `#8FD9E8`, `#98E08F` |
| Ivory Silk | `#F7F2E9` | `#2B211B` | `#2F4A3B` (`#F4F1E8`) | `#EFCB8E`, `#F2C9C0` |
| Sage Mist | `#EEF0E8` | `#24302A` | `#6B2433` (`#FFFFFF`) | `#A9C5B0`, `#E4D9C6` |
| Sandy Shore | `#FAF3E3` | `#0B2545` | `#0E7490` (`#FFFFFF`) | `#7DD3FC`, `#F5D9A8` |
| Seafoam and Sun | `#E6F6F3` | `#0B2545` | `#FACC15` (`#0B2545`) | `#99E1D9`, `#FDE68A` |

Themes are tokens on `[data-theme]` (`web/src/styles/tokens.css`), chosen in Profile → Appearance. Status colors (urgent, success, warning) are the same in every theme. High contrast, reduced transparency and forced colors swap the glass for solid panels.

## Type

Hanken Grotesk everywhere, on every theme and page: 750–800 weight with tight tracking for display, regular for body, tabular numerals for money and points.

## Shape

Sheets 28px, panels 22px, controls 14px, chips fully round. Glass panels have a white edge and a soft, ink-tinted shadow.

## Principles

1. Dollars first: balances are shown as what they buy.
2. Every suggestion says why, and a held-back notification says why not.
3. Sample data is labeled in place. Mock third-party pages (program consent, seller checkout) are deliberately plain and white, so leaving Perkly is obvious.
4. Charts on /insights use a validated two-color palette with a table view.
