# Product and domain evidence

User instructions, 1 November 2026:

1. Own downloaded bank, shown by subject, mixed mock examinations in official proportions, GitHub repository in qwerty (verified account py-qwerty), publish the application.
2. Explicit revision: minimal mobile web app, not a desktop website. Single question screens and bottom navigation; desktop retains mobile dimensions.
3. Topic tests have exactly ten questions. Store answers and progress for those tests. Clarified exception for mock examinations: store only the final result; do not persist in-progress answers or position.

## Official full PER examination

Real Decreto 875/2014, consolidated Annex II section 3, verified 1 November 2026:
https://www.boe.es/buscar/act.php?id=BOE-A-2014-10344#ai-2

45 independent questions, four options, 90 minutes, at least 32 correct. Quotas by subject 1–11: 4,2,4,2,5,10,2,3,4,5,4. Maximum errors: buoyage 2, collision regulations 5, chart work 2; total 13. Unanswered questions cannot be correct and count against the error limits. No PNB-complementary examination mode.

## Data

Own Boat Málaga bank, exported 1 November 2026: 1464 records, 149 source tests, 11 subjects and 8 images. Answers copied from source, not independently certified. No credentials or student data. Keep source duplicates in study, avoid identical signatures within mock examinations. To make all practice tests exactly ten questions while covering the entire bank, the last partial block wraps with distinct IDs from the start of the same topic. Explain this in the topic list. Preserve option order to retain references to other answers.

Chart exercises use the Estrecho de Gibraltar practice chart. User instruction, 9 November 2026: topic 11 exercises open the PER teaching chart (L105 enseñanza, user-supplied KAP) georeferenced in latitude/longitude, with the tools needed to solve them virtually. The app supplies points (tap or coordinates), ruler (true bearing and distance), bearing lines, distance circles and snapping to intersections. Rhumb-line maths, 1 mile = 1′ of latitude. The scan's distortion against the printed graticule is corrected (scripts/calibrate-chart.py). Not valid for navigation. It does not solve exercises or apply compass corrections for the user.

## Access and retention

The user explicitly requested public visibility and GitHub publication after the initial private deployment. Public GitHub repository and GitHub Pages hosting; the separate Sites copy remains owner-private. Browser-only storage, no backend/analytics/synchronization. Practice answers, checked feedback, current position and completion are persisted per ten-question test. Repeating a test explicitly resets that test after confirmation.

A mock examination exists in the current page's memory only. In-app navigation can return to the running attempt without pausing time, but closing or reloading discards it. Only a delivered/expired examination's final snapshot and grade are persisted for result review. Browser-local data disappears if the browser data is cleared. Storage failure triggers an explicit warning and in-memory fallback.
