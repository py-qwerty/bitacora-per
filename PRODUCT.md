# Product and domain evidence

User request, 1 November 2026: show the downloaded bank by subject, add randomly mixed mock examinations in the real proportions and with real pass/fail rules, create and push a GitHub repository under the user's qwerty account. The active GitHub CLI account was verified as py-qwerty; the connector belongs to another account, so the CLI is used for that destination.

## Authoritative rules

Real Decreto 875/2014, consolidated text, Annex II, section 3 (verified 1 November 2026):
https://www.boe.es/buscar/act.php?id=BOE-A-2014-10344#ai-2

Full PER examination: 45 independent questions, 4 options, 90 minutes, at least 32 correct. Subject quotas 1–11: 4,2,4,2,5,10,2,3,4,5,4. Maximum errors: buoyage 2, collision regulations 5, chart work 2; total 13. An unanswered question cannot count as correct and counts against those error limits. This app does not implement the PNB-complementary examination.

## Bank contract

Own Boat Málaga bank, exported from the user's authenticated course on 1 November 2026. 1464 question records, 149 tests, 11 subjects, 8 images. Correct answers are copied from source, not independently certified. Normalize to question IDs, unit number, source test title and ID, statement, ordered options, correct option, image path. No credentials, user information or attempt history in the dataset. Keep repetitions in study; sample unique question signatures in each mock examination. Some chart exercises require physical Estrecho de Gibraltar practice chart and plotting tools; the app does not claim to reproduce those tools.

## Access and persistence

Private GitHub source and owner-private Sites hosting by default. No login implementation, backend, analytics, synchronization, or third-party runtime fetch. Local browser storage contains consulted answer IDs, active mock examination, and finished attempts. Persist a fixed wall-clock deadline; no pause on navigation, refresh, tab hiding or closing. Store failures must be visible; browser-local progress is not guaranteed if browser data is cleared. Authorship/data rights were stated by the user.
