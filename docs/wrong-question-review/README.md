# Incorrect-question review navigation

Opening a question from a mock's results previously unmounted the results screen,
so returning recreated its ScrollView at the top. The results now stay mounted at
the same size behind the detail screen, with touch and accessibility access hidden
until the user returns. No persisted history or grading rules change.

The review detail navigates only through that mock's latest incorrect answers,
in their original order. Its header shows the current review position and total;
the body identifies the original mock question number. Previous/next buttons stay
visible below the scrolling content. A keyed detail resets each new question to
the top. First/last boundaries do not wrap; a single incorrect question disables
both controls. Bookmarked-question details retain their existing behavior.

Horizontal single-finger gestures require a clear horizontal direction and 60 px
of travel. Vertical, short, cancelled and multi-finger gestures do not advance.
Enlarging a practical diagram disables question swiping until the diagram closes.

Validation:

- `python tools/test_wrong_review_ui.py`: actual MockResult, QuestionDetail and
  PracticalQuestion components with React DOM/native host adapters. Covers the
  retained list identity and scroll offset across repeated visits/bookmark changes,
  incorrect-only order, both buttons and gesture callbacks, boundaries, zoom and
  bookmark-only details. Layout checks cover 320, 393 and 768 px widths, both themes
  and 1.3x text size. `verification.json` records the result.
- TypeScript, exam-attempt logic, all 35 active-exam explanation visibility cases,
  practical-question grading/rendering and study-feedback timing tests passed.
- Screenshot files are browser previews, not physical-device screenshots. Native
  OS gesture dispatch and device-side OTA application remain unverified.

Home, settings, lesson content, diagrams and native configuration are unchanged.
The change uses existing React Native APIs and can be delivered by iOS EAS Update
on runtime 1.1.0 without a new binary. `release.json` records delivery verification.
