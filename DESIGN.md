# Design System — PURE OS

<!-- impeccable:design-schema 1 -->

## Mode

Operate (Titanium Cybernetic Academic Software System)

## Aesthetic Identity & Vision

PURE OS es una consola de trabajo académico con la calma editorial de Notion: superficies neutras cálidas, casi sin cromía, tipografía legible y jerarquía que deja respirar el contenido. Fondos carbón cálido (`#191919`) en oscuro y blanco cálido (`#ffffff`) en claro, bordes hairline apenas visibles, y **acentos sobrios y desaturados** —no neón— reservados para codificar carrera/estado: azul (`#529cca`/`#337ea9`), violeta (`#9a6dd7`/`#9065b0`) y verde (`#529e72`/`#448361`), en los tonos muted de Notion. Sin glow, sin retículas decorativas, sin iconos de colores en cajitas tintadas.

---

## Anti-Pattern Ban List (Impeccable Craft Floor)
- ❌ **No Eyebrows / Kickers:** Prohibidos arriba de los títulos principales.
- ❌ **No Marketing Fluff / Slogans:** Prohibidos eslóganes o badges decorativos sin métricas numéricas asociadas.
- ❌ **No Unearned Containers:** Prohibido anidar tarjetas dentro de tarjetas sin jerarquía estructural.
- ❌ **No Monospace as Costume:** La fuente `JetBrains Mono` se restringe estrictamente a datos, códigos, horas y notas numéricas.
- ❌ **No Neon / No Glow:** Prohibidos acentos saturados (cian/verde ácido/violeta neón), `box-shadow` luminosos, retículas de puntos decorativas y scrollbars de color. El acento es sobrio y desaturado.
- ❌ **No Colored Icon Boxes:** Prohibido el patrón "icono de color dentro de cajita tintada redondeada" (`bg-cyan-100 text-cyan-600`). Los iconos son monocromos (`text-slate-400/500`), sin caja.
- ❌ **No Side-Tab Accent Bars:** Prohibida la barra de acento gruesa a un lado de una tarjeta o item de navegación. El estado activo se marca con fondo gris sutil.

---

## Palette & Surface System

### Light Mode (`html.light`) — Blanco cálido editorial
- `--bg-main`: `#ffffff` (Blanco de contenido)
- `--bg-sidebar`: `#f7f7f5` (Gris cálido de columna)
- `--bg-card`: `#ffffff` (Contenedor plano)
- `--bg-surface-subtle`: `#f1f1ef` (Realce sutil)
- `--border-color`: `rgba(0,0,0,0.09)` (Hairline)
- `--text-primary`: `#37352f` (Negro cálido de Notion)
- `--text-secondary`: `#6f6e69` (Gris cálido)

### Dark Mode (`html.dark`) — Carbón cálido
- `--bg-main`: `#191919` (Carbón cálido, nunca negro puro)
- `--bg-sidebar`: `#202020` (Columna lateral)
- `--bg-card`: `#202020` (Contenedor plano)
- `--bg-surface-subtle`: `#252525` (Realce sutil)
- `--border-color`: `rgba(255,255,255,0.08)` (Hairline)
- `--border-hover`: `rgba(255,255,255,0.16)` (Realce al interactuar)
- `--text-primary`: `#e9e9e7` (Off-white cálido, no blanco puro)
- `--text-secondary`: `#9b9b9b` (Gris cálido)

### Muted Accents (codificación funcional, nunca decorativa)
Tonos desaturados de Notion. Se usan con moderación: puntos, bordes tenues, texto de etiqueta. Nunca neón, nunca glow.
- **Aeroespacial Degree:** Muted Blue (`#529cca` dark / `#337ea9` light)
- **Software Degree:** Muted Violet (`#9a6dd7` dark / `#9065b0` light)
- **Positive / Synergy:** Muted Green (`#529e72` dark / `#448361` light)
- **Warning / Alert:** Amber (`#d97706`) — solo señales funcionales
- **Danger / Conflict:** Red (`#dc2626`) — solo sobrecarga/vencido

---

## Typography Scale

- **Display Headers (`h1`, `h2`):** `font-heading` (`Space Grotesk`), `font-bold` a `font-extrabold`, `tracking-tight` (-0.03em).
- **Section Headers (`h3`, `h4`):** `font-heading` (`Space Grotesk`), `font-bold`.
- **Body & Controls (`p`, `button`, `input`):** `font-sans` (`Inter`), `leading-normal`.
- **Metrics & Telemetry (`span.font-mono`, `code`):** `font-mono` (`JetBrains Mono`), números y códigos exactos.

---

## Component Radius Scale

- **Modals / Hero Overlays:** `16px` (`rounded-2xl`)
- **Cards & Data Panels:** `12px` (`rounded-xl`)
- **Buttons, Inputs & Selects:** `8px` (`rounded-lg`)
- **Status Pills / Code Badges:** `4px` (`rounded-md`)
