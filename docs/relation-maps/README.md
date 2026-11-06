# Relationship diagrams

The former six-branch / three-topic template is replaced by **19 focused diagrams**
across all six chapters. Each arrow states a relationship. Branches distinguish
conditions or perspectives; joins connect contributing conditions or shared results.
All 108 existing topics remain available under the relevant diagram.

- Chapter 1: responsibility, installation conditions, inspection systems.
- Chapter 2: capacity AND placement, suitability AND location, applicable standards.
- Chapter 3: force / moment / work, stress and strain, constant-condition gas laws.
- Chapter 4: extinguishing mechanisms, pressure paths, gauge interpretation, inspection.
- Chapter 5: approval and verification, capability and suitability, safe operation.
- Chapter 6: corroborating identification clues, parts and tools, evidence-based answers.

## Authoring

Edit the canonical `../教材解説/相関図.md`. Its versioned snapshot is `source.md`
in this directory; a clean checkout uses that snapshot when the parent file is absent.
Do not edit generated `structure.json`, SVG/PNG files or TypeScript registries.
The generator checks the graph (unique nodes, no orphan nodes, forward arrows,
noncrossing lanes), all topic references and coverage of all 108 topics.

```text
python tools/build_relation_maps.py
node node_modules/typescript/bin/tsc --noEmit
node node_modules/tsx/dist/cli.mjs tools/test_relation_maps.ts
python tools/verify_relation_maps.py
```

Generation requires Pillow, Python Playwright and local Chrome (`--browser` can
override its path). It produces 38 themed SVG/PNG pairs at 720 px width with
content-dependent height. `--svg-only` explicitly skips PNG previews.
Font measurement uses Meiryo regular and bold; authored line breaks preserve
meaningful word boundaries. Browser verification also checks text inside each node.

## Screen and verification

`src/ui/RelationMapScreen.tsx` shows one question and diagram at a time. It provides
light/dark themes, 1× / 1.5× / 2× / 3× zoom, an equivalent text relationship list,
native text supporting font scaling, and related topic explanations. Lesson links
open the corresponding canonical lesson and return to the same selected diagram.
Free/Pro gating is preserved for both the inline diagram and fullscreen modal.

- `interaction-verification.json`: actual component callbacks; all diagram selections,
  topic coverage, lesson-link round trips, zoom limits and entitlement gating.
- `verification.json`: every SVG/PNG pair, actual browser text bounds, overlaps and
  node containment; 320 / 390 / 430 / 768 px screen previews and 1.5× font scaling.
- `screen-*.png`: previews rendered from the actual screen with React Native host
  adapters. These are **browser previews, not physical-device screenshots**.
- `scope.json`: original home and settings unchanged; no native configuration change.

Content is based on the canonical chapter lessons. Institutional relationships
were checked against [FDMA inspection standards](https://www.fdma.go.jp/mission/prevention/post-1.html)
and the [Japan Fire Equipment Inspection Institute's certification process](https://www.jfeii.or.jp/activity/).
Diagrams summarize learning relationships; the related lessons carry detailed
requirements and exceptions.

## Delivery

These diagrams and their UI are bundled JavaScript/SVG content. Publish through
**EAS Update / production / iOS / runtime 1.1.0**, not the R2 lesson manifest.
No native dependency or configuration changed, so this change does not require a
new TestFlight binary. Server publication is verified separately from installation
on a physical device; physical-device rendering and gestures remain unverified.
