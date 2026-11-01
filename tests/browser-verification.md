# Browser verification — 1 November 2026

Executed through the connected Chrome browser against the actual local static server.

- Home renders all 11 topic links and bank count; desktop screenshot inspected.
- Setup displays 45 questions, 90 minutes, 32 minimum correct, quotas, three subject limits, official-source link and material notice.
- Started an exam; rendered 45 navigator buttons and four radio options. Selected first answer; moved next; reload retained position 2, one saved answer and the running clock (89:06, not reset).
- Marked question 2, selected another option, opened delivery modal. Dialog displayed 43 blank questions and initially focused the safe cancel action. Escape cancelled and restored focus to the delivery button. Reopened and delivered: result showed 2 correct, 0 incorrect, 43 blank, NO APTO, per-subject distribution and all failed limits. Correct answer highlighted in the review. No solutions appeared during active exam.
- Topic 5 rendered study cards; revealing a solution displayed the original answer. Search for zzzzsinresultados produced an explanatory no-results panel and working reset action.
- At 390×844: topic layout and native test filter inspected; search, full options and controls readable. Home has 11 links and scrollWidth equals innerWidth (390). Exam has 45 navigator buttons, four options, and scrollWidth 390. Mobile exam screenshot inspected. Native select popup is platform-owned; Escape dismisses it.
- Failure server returned HTTP 503 for bank.json while serving the real application: app displayed localized failure explanation, preserved-progress statement and retry button.
- Desktop and mobile share button labels, option lettering, topic labels, panel appearance and focus styling.

Core domain tests independently validate 1000 random exams, all pass/fail boundaries, blank answers and fixed deadlines. Waiting 90 real minutes was not part of the browser verification. No screen-reader audit, physical touch test, or full cross-browser matrix is claimed. Storage quota failure is handled by persistent warning and in-memory fallback; no forced browser storage-quota exhaustion test was performed.
