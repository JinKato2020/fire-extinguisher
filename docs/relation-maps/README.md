# Chapter relation maps

Six chapter maps follow the Crane app's central topic and six-branch layout.
Each chapter includes matching light/dark SVG and PNG assets (3400 x 2200).

- Assets: `assets/relation-maps/`
- Typed asset registry: `src/data/relationMaps.ts`
- Chapter structure, lesson references and official sources: `structure.json`
- Font measurement checks: `text-layout-validation.json`
- Asset and TypeScript checks: `verification.json`

The registry provides chapter metadata, PNG sources and inline SVG strings.
Render `lightSvg` or `darkSvg` using `SvgXml`, or the PNG sources using `Image`.
Keep the aspect ratio and support full-screen zoom so the outer labels remain readable.
This asset change does not include the concurrent screen/navigation redesign.
