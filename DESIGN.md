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
  page-max: "480px"
  section-gap: "32px"
components:
  button:
    height: "48px"
  card:
    rounded: "panel"
  dialog:
    rounded: "panel"
---

# Bitácora PER

## Overview

Product register: a personal Spanish study tool for the Patrón de Embarcaciones de Recreo examination. The source of domain rules is PRODUCT.md; the source bank is dist/bank.json. The audience is a beginner studying in Spain, at a laptop or phone.

The user's explicit revision is a minimal mobile web app, not a desktop website. The north star is a pocket study notebook: one column, restrained type, eleven simple topic rows, tests in blocks of ten, one question at a time, and bottom navigation. No marketing hero, large compass artwork or multi-column dashboard. Desktop retains the same narrow app width rather than expanding into a different product.

Token model B: dist/styles.css :root is the canonical runtime owner; this frontmatter mirrors the accepted values. Every colors.x maps to --color-x; typography.body/display/mono maps to --font-body/display/mono; rounded.control/panel to --radius-control/panel; spacing.page-max/section-gap to --page-max/section-gap. No framework adapter. Shared .btn, .study-question, .answer-option, and dialog consume those tokens. tests/design.test.js detects palette/radius/spacing drift.

## Colors

Deep harbor blue is the primary action and compass panel; teal marks study/navigation. Pale sea green is a quiet selected or informational surface. Success, danger, and warning have textual equivalents; no result or answer relies on color alone. White reading surfaces on a cool background. A light theme only; respect system forced colors.

## Typography

Locally hosted Manrope is the text, navigation and heading face. Main titles 26px, question text 17px/1.8, body 14px; supporting labels 9–12px. Barlow Condensed remains available but is not used to create oversized promotional headings. Spanish accents included.

## Layout

Maximum width 480px at all device sizes. A single natural document scroller with sticky 61px app header and fixed bottom navigation with safe-area padding. No desktop grids. Study: topic list → numbered ten-question tests → one question with previous/next buttons, horizontal swipes and a collapsed numbered selector. All ten-question test answers and position persist. Examination hides the tab bar; the answer sheet is a collapsed disclosure and answers remain in memory only until delivery. Final examination results persist.

The chart workspace is the single full-window exception: a modal over the app, one column on phones (chart, contextual panel, five-tool bar) and chart plus a 360px side column from 900px. Drawings use two chart-only inks defined on dialog.chart: blue #0b55c4 for strokes and orange #c2410c for the selected stroke, chosen to stay legible over the greyscale chart.

## Elevation & Depth

Panels use a one-pixel border. Only the modal has a shadow. The exam answer navigator is a document-flow disclosure. Stable scrollbars and intrinsic image boxes avoid moving controls.

## Shapes

14px panels, 8px controls, 5px option markers. The compass is the only ornamental circle. Do not round every item into a pill.

## Components

Shared .btn owns primary/secondary/text emphasis, visible focus, hover, active and disabled states. Native labels/radios own answer keyboard behavior. The app has no select or search form. Native dialog.showModal supplies focus trapping/inert background/Escape; app code supplies least-destructive initial focus and restoration. Shared global notice handles storage failure; inline notices explain local limitations.

Global scrollbar tokens --scrollbar-thumb/track/hover/active apply to all owned scrolling regions with standard scrollbar-color/width plus WebKit fallback. Forced-colors restores system operability. Horizontal dragging gives a restrained maximum 35px card displacement. Reduced motion suppresses that movement. Question changes slide out for 180ms and slide in for 240ms, in the direction of navigation, with a light fade. All question navigation paths share that transition; editing a previous answer does not animate or advance. Other motion is limited to 120ms feedback and the loading spinner; reduced motion suppresses both.

## Do's and Don'ts

- Keep question text and answers verbatim; preserve option order.
- Keep a single label for every repeated action and the same card on study/review screens.
- Do not show solutions while an exam is active.
- Do not imply that browser-local progress synchronizes or that bank answers have all been academically verified.
