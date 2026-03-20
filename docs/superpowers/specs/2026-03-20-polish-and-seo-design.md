# Polish & SEO — Design Spec

## Overview

Visual polish pass + SEO/analytics setup for Icebreaker before deployment. Four independent pieces: mesh gradient background, footer, SEO meta tags + analytics, and image assets (OG image + favicon).

## 1. Mesh Gradient Background

Apply the portfolio v1 mesh gradient to the entire app background. 18 radial-gradient blobs in cyan/magenta/purple/blue hues at low opacity.

### Implementation

On `html` element (not body — ensures iOS toolbar area gets the color):
```css
html {
  background-color: var(--color-cyber-bg);
  background-image: /* 18 radial-gradient blobs, see full list below */;
}
```

Desktop opacity: `0.07` per blob. Mobile (`@media (pointer: coarse)`): `0.10` per blob.

### iOS Safari Workaround

On mobile, the bottom toolbar area in Safari/Chrome is outside the web rendering context. No CSS can paint into it. The workaround (proven on portfolio):

1. `html` gets `background-color: var(--color-cyber-bg)` + the mesh gradient `background-image`
2. `body` gets `background-color: var(--color-cyber-bg)` + `isolation: isolate` (creates stacking context for z-index:-1 pseudo-elements)
3. `body::before` — **only on touch devices** via `@media (pointer: coarse)`:
   - Same mesh gradient as `background-image`
   - `position: fixed; inset: 0; z-index: -1;`
   - `mask-image: linear-gradient(to bottom, black calc(100% - 8rem), transparent 100%);`
   - This fades the overlay to transparent at the bottom 8rem
4. Result: on mobile, the overlay fades smoothly into the html mesh background, which blends into the iOS black toolbar area — gradual transition, not a sharp line

### Full Blob List (18 blobs, desktop 0.07 opacity)

```css
radial-gradient(at 7% 61%, hsla(200, 90%, 40%, 0.07) 0px, transparent 50%),
radial-gradient(at 96% 5%, hsla(315, 90%, 28%, 0.07) 0px, transparent 50%),
radial-gradient(at 51% 34%, hsla(270, 95%, 35%, 0.07) 0px, transparent 50%),
radial-gradient(at 84% 40%, hsla(210, 90%, 32%, 0.07) 0px, transparent 50%),
radial-gradient(at 30% 65%, hsla(190, 85%, 33%, 0.07) 0px, transparent 50%),
radial-gradient(at 26% 94%, hsla(195, 95%, 29%, 0.07) 0px, transparent 50%),
radial-gradient(at 7% 34%, hsla(310, 95%, 28%, 0.07) 0px, transparent 50%),
radial-gradient(at 65% 92%, hsla(255, 90%, 32%, 0.07) 0px, transparent 50%),
radial-gradient(at 19% 7%, hsla(245, 95%, 34%, 0.07) 0px, transparent 50%),
radial-gradient(at 87% 75%, hsla(200, 90%, 36%, 0.07) 0px, transparent 50%),
radial-gradient(at 48% 52%, hsla(180, 85%, 28%, 0.07) 0px, transparent 50%),
radial-gradient(at 84% 10%, hsla(280, 90%, 29%, 0.07) 0px, transparent 50%),
radial-gradient(at 71% 22%, hsla(220, 90%, 37%, 0.07) 0px, transparent 50%),
radial-gradient(at 39% 71%, hsla(265, 90%, 30%, 0.07) 0px, transparent 50%),
radial-gradient(at 38% 9%, hsla(330, 95%, 32%, 0.07) 0px, transparent 50%),
radial-gradient(at 34% 33%, hsla(205, 85%, 30%, 0.07) 0px, transparent 50%),
radial-gradient(at 6% 62%, hsla(295, 90%, 33%, 0.07) 0px, transparent 50%),
radial-gradient(at 74% 44%, hsla(320, 90%, 31%, 0.07) 0px, transparent 50%)
```

Mobile variant: same positions and hues, opacity changed from `0.07` to `0.10`.

## 2. Footer (Main Menu Only)

Minimal single-line footer at the bottom of the main menu screen.

### Content
```
Made by Martin Skorupa · LinkedIn · Inspired by Bitburner
```

- "Martin Skorupa" — plain text
- "LinkedIn" — links to `https://linkedin.com/in/martin-skorupa`
- "Bitburner" — links to `https://store.steampowered.com/app/1812820/Bitburner/` (or official site)

### Styling
- `text-white/20` — very dim, unobtrusive
- `text-[10px]` or `text-xs` — small
- `uppercase tracking-widest font-mono` — matches game aesthetic
- Links: `hover:text-white/40` — subtle hover state
- Positioned below the existing reset/version section in MainMenu.tsx

## 3. SEO Meta Tags + Analytics

### index.html additions

```html
<title>Icebreaker — Cyberpunk Roguelike Minigame Collection</title>
<meta name="description" content="Cyberpunk roguelike minigame collection. Hack 15 procedural protocols — decrypt signals, trace networks, crack ciphers. Upgrade your rig, survive deeper each run.">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:url" content="https://icebreaker.skorupa.dev/">
<meta property="og:title" content="Icebreaker — Cyberpunk Roguelike Minigame Collection">
<meta property="og:description" content="Cyberpunk roguelike minigame collection. Hack 15 procedural protocols — decrypt signals, trace networks, crack ciphers. Upgrade your rig, survive deeper each run.">
<meta property="og:image" content="https://icebreaker.skorupa.dev/og-image.png">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">

<!-- Theme color (matches cyber-bg) -->
<meta name="theme-color" content="#06060e">

<!-- Umami Analytics (cookieless, GDPR compliant) -->
<script defer src="https://cloud.umami.is/script.js" data-website-id="8cd10008-77cb-40a2-a35a-8b77994183c7"></script>
```

### Static files in `public/`

- `public/og-image.png` — 1200x630 OG image (renamed from user-provided `ogimg.png`)
- `public/favicon.ico` — from realfavicongenerator.net output
- `public/apple-touch-icon.png` — 180x180 from realfavicongenerator.net
- `public/robots.txt`:
  ```
  User-agent: *
  Allow: /
  ```
- `public/sitemap.xml`:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>https://icebreaker.skorupa.dev/</loc>
    </url>
  </urlset>
  ```

Only `favicon.ico` and `apple-touch-icon.png` are needed from realfavicongenerator output. Discard `favicon-16x16.png`, `favicon-32x32.png`, `site.webmanifest`, and `browserconfig.xml` — unnecessary for a SPA game.

### Favicon link tags in index.html
```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

## 4. Image Assets

User generates via ChatGPT:
- **OG image** (1200x630) — already generated as `ogimg.png` in repo root. Rename to `public/og-image.png` during implementation.
- **Favicon source** (512x512) — user generating new version, then processes through realfavicongenerator.net to get ICO + apple-touch-icon. Place resulting files in `public/`.

## What NOT to Build

- No SSR/prerendering — SPA is fine for a game
- No structured data / JSON-LD — not a content site
- No cookie consent banner — Umami is cookieless
- No custom fonts for the game — stick with system mono
- No deployment config in this spec — separate task (#42)
