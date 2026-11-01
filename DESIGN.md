---
version: alpha
name: Bitácora PER
description: Un cuaderno de navegación para estudiar el PER y ensayar el examen.
colors:
  primary: "#103f4f"
  secondary: "#126e70"
  accent: "#9bd5cd"
  background: "#f3f7f7"
  surface: "#ffffff"
  text: "#163743"
  muted: "#52707a"
  border: "#ccdadd"
  success: "#176447"
  danger: "#a33331"
  warning: "#84531c"
  tint: "#e8f2f1"
  focus: "#176b9f"
typography:
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
  mono:
    fontFamily: "ui-monospace, monospace"
rounded:
  control: "8px"
  panel: "14px"
spacing:
  page-max: "1200px"
  section-gap: "64px"
components:
  button:
    height: "46px"
  card:
    rounded: "panel"
  dialog:
    rounded: "panel"
---

# Bitácora PER

## Overview

Product register: a personal Spanish study tool for the Patrón de Embarcaciones de Recreo examination. The source of domain rules is PRODUCT.md; the source bank is dist/bank.json. The audience is a beginner studying in Spain, at a laptop or phone.

The north star is the legible labeling of a nautical instrument, with the familiarity of a study notebook. A compass occupies one half of the home introduction; all reading and exam screens remain quiet. Avoid ocean stock photography, dashboard chart clutter, game rewards, and marketing claims about passing.

Token model B: dist/styles.css :root is the canonical runtime owner; this frontmatter mirrors the accepted values. Every colors.x maps to --color-x; typography.body/display/mono maps to --font-body/display/mono; rounded.control/panel to --radius-control/panel; spacing.page-max/section-gap to --page-max/section-gap. No framework adapter. Shared .btn, .study-question, .answer-option, and dialog consume those tokens. tests/design.test.js detects palette/radius/spacing drift.

## Colors

Deep harbor blue is the primary action and compass panel; teal marks study/navigation. Pale sea green is a quiet selected or informational surface. Success, danger, and warning have textual equivalents; no result or answer relies on color alone. White reading surfaces on a cool background. A light theme only; respect system forced colors.

## Typography

Locally hosted Barlow Condensed 600 is reserved for headings and instrument-like numbers. Locally hosted Manrope 400–700 is the body and controls face. Spanish accents are included. Body 15px/1.65; question reading 17–21px with 1.65–1.8 line height; phone questions 15–17px. Utility text is smaller but never used for question content. No remote font dependency.

## Layout

Maximum content width 1200px. Desktop: three topic columns, two setup panels, question plus 280px navigator. At 950px: two topic columns; at 700px: stacked exam/setup, two concise topic columns. Natural document scrolling. Header navigation wraps into its own row on phone. Pagination is 20 study questions per page, with state in the hash URL.

## Elevation & Depth

Panels use a one-pixel border. Only the modal has a shadow. The navigator may stick on desktop but is ordinary document content on phone. Stable scrollbars and intrinsic image boxes avoid moving controls.

## Shapes

14px panels, 8px controls, 5px option markers. The compass is the only ornamental circle. Do not round every item into a pill.

## Components

Shared .btn owns primary/secondary/text emphasis, visible focus, hover, active and disabled states. Native labels/radios own answer keyboard behavior. Native select is deliberately platform-owned. Search has a clear button and a labeled input. Native dialog.showModal supplies focus trapping/inert background/Escape; app code supplies least-destructive initial focus and restoration. Shared global notice handles storage failure; inline notices explain local limitations.

Global scrollbar tokens --scrollbar-thumb/track/hover/active apply to all owned scrolling regions with standard scrollbar-color/width plus WebKit fallback. Forced-colors restores system operability. Motion is limited to 140ms feedback and the loading spinner; reduced motion suppresses both.

## Do's and Don'ts

- Keep question text and answers verbatim; preserve option order.
- Keep a single label for every repeated action and the same card on study/review screens.
- Do not show solutions while an exam is active.
- Do not imply that browser-local progress synchronizes or that bank answers have all been academically verified.
