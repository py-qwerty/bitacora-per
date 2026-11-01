# Browser verification — final mobile revision, 1 November 2026

Executed in connected Chrome against the actual static application. Screenshots and DOM state inspected at 390×844, and initial desktop view verified. Final application keeps a maximum 480px mobile width even on desktop.

- Mobile home renders 11 simple topic rows, bottom navigation and completed-test count. No marketing hero, compass panel or desktop grid. Width and document scrollWidth both 390px.
- Theme → numbered tests → one-question screen. Started topic 1 test 1; selected first answer, checked it and moved to question 2. Reload retained question 2 and the saved response/checked state for question 1.
- Completed all ten questions, delivered with a zero-blank confirmation, and received the 1/10 test summary. Read-only review displayed checked solutions; home retained completion (1 of 150 ten-question tests). The 150 practice blocks differ from the 149 original source tests because all blocks are now exactly ten.
- Mock setup shows 45 questions, 90 minutes, 32 minimum correct, three subject limits and the no-progress-saving notice. Started a mock, answered one question and reloaded. The app displayed no active attempt: progress was discarded as requested.
- Started another mock, answered and delivered. Reload retained the NO APTO final result and its source answers. Review rendered one question per screen. Width/scrollWidth remained 390px.
- Delivery modal safe initial focus, Escape cancellation and focus restoration had been exercised in the earlier same-primitive flow; the revised practice delivery also initially focuses its safe action.
- Mobile answer options, feedback, previous/next, bottom tabs, exam header, collapsed answer sheet and topic rows visually inspected. Fixed bottom tabs have safe-area spacing and content bottom padding, and are hidden during mock exams.
- Error server (HTTP 503 on bank.json) exercised the same finite-timeout loading/failure component: localized explanation and retry; no browser data deletion.
- Chrome errors checked after the original flow: none. Final syntax/domain tests also pass.

Core tests cover 1000 random exams, quotas, all grading thresholds, blanks, fixed deadlines, all ten-question blocks, complete coverage, serialized practice recovery and the absence of in-progress mock storage writes. Waiting 90 real minutes, screen-reader auditing, physical touch tests, storage-quota exhaustion and a full cross-browser matrix are not claimed. No offline mode or multi-device synchronization is implemented.

## Automatic progression revision

Verified in actual Chrome after the change: topic 2 test 1 first answer advanced to question 2; returning to question 1 and changing A to B stayed on question 1. Reload preserved question 1 and answer B. The same first-answer advancement and edit-in-place behavior passed in a 45-question mock (question 2 after first answer, question 1 after returning and editing). The final question condition is bounded by ids.length - 1 and does not deliver automatically. Existing 13 checks pass.

## Swipe navigation revision

Actual Chrome drags at 390px width moved practice 1→2 (left), 2→1 (right), and mock 1→2→1. Dragging across an answer option did not select an answer. A vertical drag retained the question. Returning by swipe and immediately editing the answer retained question 1 and saved B. The numbered selector opened question 10, where Terminar test remained available; dragging left at question 10 did not wrap or submit. A deliberate press on Entregar simulacro immediately after a swipe still opened its confirmation. No next/previous buttons remain. Pure swipe tests reject short, vertical and diagonal gestures. Physical touchscreen and cross-browser touch testing were not performed.
