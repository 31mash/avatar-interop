# Hockney Joiner — Panography Style Converter

A client-side web app that transforms any uploaded image into a David Hockney-style photographic collage ("joiner" / panography).

## Run locally

```bash
cd hockney-converter
npm install
npm run dev
```

Then open the URL printed in your terminal (e.g. `http://localhost:5173`).

## Run in a cloud sandbox (CodeSandbox, StackBlitz, Gitpod, etc.)

The project includes `vite.config.js` configured with `host: true` and a
`.codesandbox/tasks.json` that starts `npm run dev` automatically, so the
preview link in those environments should work out of the box. If the
preview doesn't load, run:

```bash
npm install && npm run dev
```

## Build for static hosting (GitHub Pages, Netlify, Vercel, etc.)

```bash
npm run build
```

The static site is emitted to `dist/` and can be served by any static host.

## How it works

The Hockney joiner algorithm (in `hockney.js`) breaks the source image into a
grid of overlapping rectangular fragments, then redraws each fragment with:

- random rotation (simulating hand-held photos)
- scatter/displacement from the grid position
- overlap between adjacent tiles
- subtle per-tile brightness and warm/cool color shifts
- white photo-print borders
- drop shadows
- shuffled draw order so overlaps look natural

Adjustable via sliders: grid columns, rows, rotation, scatter, overlap,
color variation, border width, and shadow intensity. A **Randomize** button
shuffles all sliders, and **Download** exports the result as PNG.

All processing happens in-browser using the Canvas 2D API — no server, no
external services.
