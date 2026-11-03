# Chapter relation maps

Six chapter maps follow the Crane app's central topic and six-branch layout.
Each chapter includes matching light/dark SVG and PNG assets (3400 x 2200).

- Assets: `assets/relation-maps/`
- Typed asset registry: `src/data/relationMaps.ts`
- Chapter structure, lesson references and official sources: `structure.json`
- Font measurement checks: `text-layout-validation.json`
- Asset and TypeScript checks: `verification.json`

## Editing and generation

Edit `structure.json` for map wording. Lesson bodies remain canonical in the parent
`教材解説/*.md` files; do not edit generated lesson JSON to change textbook prose.
The map generator validates each topic's lesson references against those Markdown files.

Run `python tools/build_relation_maps.py` from the app directory. It generates all
12 SVGs, matching 3400 × 2200 PNGs, font measurements and both TypeScript registries.
Dependencies: Pillow, Python Playwright and local Google Chrome. Use `--browser`
to override its executable or `--svg-only` only when PNG output is intentionally skipped.

`App.tsx` reads the embedded SVGs from `src/data/relationMaps.generated.ts` and the
same `structure.json` for the readable topic cards. The optional PNG registry
references those SVG strings instead of carrying another independently edited copy.
Fullscreen starts at 2550 px canvas width, with zoom, fit and readable-size controls.
Both horizontal and vertical scrolling are available. Native text cards support
system font scaling and remain gated consistently with the diagram.

These maps are bundled app content: publish with **EAS Update / production / iOS**.
They are not served by the R2 lesson manifest. No native dependencies were added.

## Review on 2026-11-03

- Reviewed all 6 chapters (108 topics), light and dark variants.
- Clarified qualification duties, rigid-body equilibrium, the axial average stress
  formula, the equal-force condition for pressure comparison, stored pressure,
  pressure regulator use, standard gauge purpose and written/symbol practice.
- Strengthened leaf connectors and increased title/central summary spacing.
- Added readable topic cards and explicit zoom controls for small screens.
- Checked against the canonical lessons, the [Fire Examination Center](https://www.shoubo-shiken.or.jp/shoubou/),
  [FDMA equipment inspection material](https://www.fdma.go.jp/mission/prevention/post-1.html)
  and [OpenStax equilibrium conditions](https://openstax.org/books/university-physics-volume-1/pages/12-1-conditions-for-static-equilibrium).

Validation:

```text
npx tsx tools/test_relation_maps.ts
python tools/verify_relation_maps.py
npx tsc --noEmit
npx expo export --platform ios
```

The first test renders the actual screen with host adapters, checks all topics,
light/dark switching, access gating and zoom callbacks. The Python check validates
SVG metadata against the source, PNG dimensions, actual browser text bounds and
text overlaps, and creates visual previews in ignored `tmp/`. These are browser
previews, not physical-device QA. Native scrolling gestures still require device confirmation.
