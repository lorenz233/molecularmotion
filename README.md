# Molecular Drift

An interactive 3D molecular observatory for exploring chemistry in motion.

**[Open the live demo](https://lorenz233.github.io/molecularmotion/)**

Molecular Drift turns familiar compounds into an immersive, explorable 3D
experience. Start with a curated molecule, search the PubChem archive, rotate
the structure, switch rendering styles, and explore it with optional hand
tracking.

## What it does

- Renders molecules as interactive 3D atom-and-bond models
- Includes a curated collection of example molecules
- Searches PubChem by molecule name, CAS number, or SMILES
- Shows molecular formula, mass, geometry, and context
- Supports ball, space-filling, and wireframe model styles
- Offers velvet, aurora, and X-ray visual treatments
- Includes optional webcam hand controls powered by MediaPipe
- Works as a static site on GitHub Pages

## Built with

- React and TypeScript
- Three.js for 3D rendering
- Vite for the static application build
- PubChem PUG REST API for molecule data
- MediaPipe Tasks Vision for hand tracking
- GitHub Actions and GitHub Pages for deployment

## Run it locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

Then open the local address shown in the terminal.

To create a production build:

```bash
npm run build
```

The webcam hand-control feature is optional. The browser will ask for camera
permission only when that feature is enabled.

## Deploy to GitHub Pages

Every push to `main` runs the workflow in
`.github/workflows/deploy-pages.yml`. The workflow builds the static site and
publishes it to:

```text
https://lorenz233.github.io/molecularmotion/
```

In the repository settings, make sure **Settings → Pages → Source** is set to
**GitHub Actions**.

The deployed site is entirely client-side: the 3D viewer, molecule search,
MediaPipe hand tracking, landmark overlay, visual modes, and momentum release
all run in the browser. PubChem is queried directly from the browser, so no
server or Cloudflare runtime is required.

## Project structure

```text
app/        Main interface and styling
lib/        PubChem molecule lookup helpers
public/     Static assets and icons
tests/      Rendered output checks
.github/    GitHub Pages deployment workflow
```

## License

This project is currently intended as an experimental personal project.
