# UX contract

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Navigation | index.html bottom-nav, app.js render | User mobile revision / DESIGN.md | topics / practice / mock / history | Browser mobile flow |
| Scrollbar | styles.css global baseline | DESIGN.md | table horizontal scrolling | DOM width check |
| Toast | #notice role=status | PRODUCT.md storage fallback | persistent storage warning | Static evidence |
| Dialog | native dialog + ask() | This contract | finish / reset / replace | Safe focus, Escape and submit |
| Local data | read/write/getPractice | PRODUCT.md user retention decision | practice state / final mock results | Reload browser check |

No dropdown, date picker, table selection, billing, permission editor or remote mutations.

## Flows

- Topic list → ordered ten-question test blocks → one question per screen. Swipe left to advance and right to return; selected answer, position and explicit check persist per test. Previous/next buttons are always available alongside gestures. A collapsed numbered selector and keyboard arrows outside controls provide non-drag alternatives. Last incomplete topic block fills to ten using questions from the beginning; this is disclosed. Original bank provenance retained, study sequence sorted by source test number then question order.
- The Avance automático switch controls whether a first answer to an unanswered question advances one position in practice and mock exams. Its browser-local preference is persisted and defaults to enabled to preserve previous behavior. When disabled, choosing an option stays on that question so practice users can check it before proceeding with buttons/swipe. Mock examination solutions remain hidden until delivery. Editing an existing answer stays on that question. The last question stays in place; delivery is always explicit. Focus follows the new question on automatic advancement.
- Practice select → save answer locally; check → show source solution, preserve feedback; next → save position. Reload resumes that exact test. Finish → confirm blank count → grade and persist. Reopen completed test → summary. Review → read-only solutions, preserves completion; repeat → explicit confirmation then clears that test only.
- Mock setup → start creates 45 questions and fixed deadline in page memory only. No in-progress session write. Refresh/close loses the attempt, explicitly explained. In-app navigation can return while the clock continues. Four radios, clear response, flag, bidirectional horizontal swipes and collapsed 45-question answer sheet.
- Deliver mock → modal shows unanswered count; cancel/Escape restores focus; deliver grades and persists one final snapshot for history/review. Deadline expiry does the same without another prompt. Replace running mock explicitly delivers the old attempt and starts another.
- Results show total and failed subject limits; subject table is a disclosure. Review is one question per screen with errors/all filter. History reopens delivered results, never in-progress attempts.

## Failure and accessibility

Finite bank loading timeout, stable spinner and retry view. Persistent warning when browser storage fails; memory fallback does not claim durable saving. Study updates read latest stored state; storage events refresh open practice in another tab. No cross-device synchronization or invigilated/tamper-resistant claims.

Spanish Spain, result dates Europe/Madrid. App maximum width 480px, natural document scroll, fixed bottom tabs with safe-area inset; tabs hidden during mock examination. Semantic links/buttons/radios/tables and native disclosure. Main focus after route changes; question focus after mock navigation. Native dialog provides focus trap/inert background/Escape; safe action focused first. Colors have text equivalents. Reduced motion and forced colors supported. No browser alert/confirm/prompt.

## Business sources

User revisions and clarified retention exception: PRODUCT.md. Official quotas/time/grading: PRODUCT.md / Real Decreto 875/2014 Annex II. Bank/answers: dist/bank.json. Access/private defaults: user request and PRODUCT.md. No deletion of account data, billing or permission-changing flows.

## Gesture navigation

A deliberate horizontal drag of at least 44 CSS pixels, predominating over vertical displacement by 1.25×, changes one question. Short drags/taps, vertical scrolling, pointer cancellation, and browser-edge gestures never navigate. Native vertical scrolling and pinch zoom remain allowed. A recognized drag suppresses its synthetic click so answer options are not accidentally selected; a subsequent intentional pointerdown resets this suppression. Study saves the new index, mock exams keep it only in memory, review uses the same bounded navigation. No wrapping or automatic submission at either end. Number selectors and keyboard arrows provide non-drag alternatives. Buttons/links/disclosures are excluded from swipe starts.

Question changes share an interruptible two-phase lateral transition: 180ms exit and 240ms entrance. Responses and practice position are committed before animation. Controls are temporarily inert to prevent duplicate changes during the transition; route changes cancel it and restore interactivity. Focus moves to the new question after animation. Reduced-motion preferences use an immediate change. Timer expiry remains authoritative and cancels any obsolete transition.

Touch capture transfer: loss-of-capture events bubbling from a child (e.g. an answer option) do not cancel a gesture captured by main. Reset occurs only when main itself loses this pointer's capture. The buttons, swipe and numbered selector use the same bounded animated navigation.

Question changes preserve the current horizontal and vertical document scroll across buttons, swipes, numbered/keyboard jumps and automatic advancement, including result review and reduced-motion mode. Focus uses preventScroll. A minimum height floor retains the current viewport when the next question is shorter; that floor is cleared on ordinary page navigation. No question change scrolls back to the heading or top.
