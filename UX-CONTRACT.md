# UX contract

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Navigation | app.js currentRoute/render, index.html nav | This contract | study / exam / result | Browser flow |
| Select/Listbox | native select#test-filter | DESIGN.md | platform-owned native popup | Keyboard and popup browser check |
| Form | question-search form, setFilters | This contract | subject search | No-results and clear check |
| Scrollbar | styles.css global baseline | DESIGN.md | table horizontal scrolling | DOM style/phone check |
| Toast | persistent #notice role=status | This contract | storage failure | Static and failure-path tests |
| Dialog | native dialog + ask() | This contract | submit / replace exam | Focus, Escape, cancel/submit |
| Local data | read/write/updateSession | PRODUCT.md | studied IDs / active / result | Refresh and core tests |

No table selection, date picker, remote mutations, billing or permissions editor is applicable.

## Flows

- Topic card → topic list, 20 per page. Search by statement/option text and source test. Query, test and page live in URL hash. Explicit submit and Enter commit local search, no asynchronous search race. Clear is immediate. Empty state offers reset. Read-only answer reveal records an ID as consulted, not a claim of mastery. Bank/source PRODUCT.md.
- Simulacro → setup → start creates 45 questions, persists them and a deadline → examination. The timer starts only on start. Shuffle all selected questions while keeping options fixed. Source PRODUCT.md official quotas.
- Examination → select/change/clear answer, mark/unmark, jump/next/previous. Store each change. Navigation does not discard the attempt. Returning reloads the stored attempt; refresh never grants time. Core grading/clock owned by core.js.
- Deliver → app-owned confirmation with unanswered count; cancel returns to trigger; submit grades, persists finished attempt and navigates to result. Deadline expiry submits without another prompt. Repeated finalization uses the same session ID. Replace active attempt explicitly delivers the old one and starts another.
- Result → verdict, total, disaggregated limits, reasons, review all or errors/blanks → history. History reopens results. No delete action. Source PRODUCT.md rules and local retention.

## State and recovery

Initial bank fetch: stable loading area with spinner and finite timeout; failed fetch: preserve browser data and offer retry. Local storage unavailable/full: persistent warning; current document may continue in memory, no claim of persistent saving. Multiple tabs read latest session before updates and refresh the current exam on storage events; this is browser practice, not an invigilated exam or tamper-resistant environment.

## Locale and accessibility

Spanish (Spain); result dates Europe/Madrid. All visible acronyms expanded in context or the rules page. Semantic anchors/buttons/radios/tables. Native select popup geometry is intentionally OS-owned. Skip link focuses main without changing application route. Navigation focuses main; exam next focuses question heading. Native modal handles inert background and focus trap; cancel initially focused. Color is supplemental. No browser alert/confirm/prompt. Reduced motion and forced colors respected. Narrow layout uses natural scrolling.

## Business context sources

| Concern | Owning evidence |
| --- | --- |
| Examination rules and limits | PRODUCT.md / Annex II of Real Decreto 875/2014 |
| Bank and answers | PRODUCT.md / dist/bank.json |
| Permissions | User's current request and PRODUCT.md private default |
| Persistence/data lifecycle | PRODUCT.md browser-only retention |
| Deletion/billing | Not applicable; no such actions |
