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

- Topic list → ordered ten-question test blocks → one question per screen. Previous/next, selected answer and explicit check persist per test. Last incomplete topic block fills to ten using questions from the beginning; this is disclosed. Original bank provenance retained, study sequence sorted by source test number then question order.
- First answer to an unanswered question automatically advances one position in practice and mock exams. Editing an existing answer stays on that question. The last question stays in place; delivery is always explicit. Focus follows the new question on automatic advancement.
- Practice select → save answer locally; check → show source solution, preserve feedback; next → save position. Reload resumes that exact test. Finish → confirm blank count → grade and persist. Reopen completed test → summary. Review → read-only solutions, preserves completion; repeat → explicit confirmation then clears that test only.
- Mock setup → start creates 45 questions and fixed deadline in page memory only. No in-progress session write. Refresh/close loses the attempt, explicitly explained. In-app navigation can return while the clock continues. Four radios, clear response, flag, previous/next and collapsed 45-question answer sheet.
- Deliver mock → modal shows unanswered count; cancel/Escape restores focus; deliver grades and persists one final snapshot for history/review. Deadline expiry does the same without another prompt. Replace running mock explicitly delivers the old attempt and starts another.
- Results show total and failed subject limits; subject table is a disclosure. Review is one question per screen with errors/all filter. History reopens delivered results, never in-progress attempts.

## Failure and accessibility

Finite bank loading timeout, stable spinner and retry view. Persistent warning when browser storage fails; memory fallback does not claim durable saving. Study updates read latest stored state; storage events refresh open practice in another tab. No cross-device synchronization or invigilated/tamper-resistant claims.

Spanish Spain, result dates Europe/Madrid. App maximum width 480px, natural document scroll, fixed bottom tabs with safe-area inset; tabs hidden during mock examination. Semantic links/buttons/radios/tables and native disclosure. Main focus after route changes; question focus after mock navigation. Native dialog provides focus trap/inert background/Escape; safe action focused first. Colors have text equivalents. Reduced motion and forced colors supported. No browser alert/confirm/prompt.

## Business sources

User revisions and clarified retention exception: PRODUCT.md. Official quotas/time/grading: PRODUCT.md / Real Decreto 875/2014 Annex II. Bank/answers: dist/bank.json. Access/private defaults: user request and PRODUCT.md. No deletion of account data, billing or permission-changing flows.
