# Shop Builder 3D Feature

This directory contains the upcoming implementation for the 3D shop layout builder.

## Structure

- `ShopBuilder3DPage.tsx` – Top-level React page that composes the builder experience.
- `index.ts` – Entry point for exporting the feature.
- `types.ts` – Shared TypeScript interfaces for walls, products, layout, and camera state.
- `store.ts` – State container (provider + actions) used across Floorplan.js and Three.js layers.
- `floorplan/` – Wrappers around Floorplan.js for wall editing and layout serialization.
- `three/` – Three.js scene management (renderer, camera, lighting, model loading).
- `ui/` – Toolbar, modals, and other UI elements built with the project theme.
- `utils/` – Helper utilities for snapshot capture, layout import/export, etc.
- `sampleModels.ts` – Placeholder catalog of sample product models for testing.

Implementation is staged. Each file currently contains scaffolding with TODO comments describing the next steps.
