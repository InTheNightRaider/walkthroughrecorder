# Walkthrough Recorder — Chrome Extension v2.4

Record click-through product walkthroughs, annotate screenshots, and export a self-contained HTML demo that embeds anywhere via iframe.

---

## What's included

| Folder / File | What it does |
|---|---|
| `manifest.json` + `*.js` / `*.html` / `*.css` | The Chrome extension itself |
| `lib/jszip.min.js` | ZIP bundler (vendored, no install needed) |
| `icons/` | Extension icon PNGs |
| `guide-dashboard/` | Separate Netlify site — hosts exported ZIPs at stable URLs, generates iframe embed code |

---

## Install the Chrome Extension

1. Clone or [download this repo as a ZIP](https://github.com/InTheNightRaider/walkthroughrecorder/archive/refs/heads/main.zip) and unzip it.
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right)
4. Click **Load unpacked**
5. Select the root folder of this repo (the one containing `manifest.json`)

The extension icon will appear in your toolbar. That's it — no npm install, no build step.

---

## Record a walkthrough

1. Click the extension icon → enter a project name → **Start Recording**
2. Click through your app normally. Each click captures a screenshot + click position.
3. When done, click the extension icon → **Stop & Review** (or hit the Stop button on the page indicator)
4. The full-page editor opens automatically

---

## Edit in the full-page editor

| Feature | How |
|---|---|
| Add tooltip title/body | Inspector panel on the right |
| Reposition the hotspot dot | Drag it, or use **Arrow keys** (0.5% nudge) / **Shift+Arrow** (5% nudge) |
| Navigate steps | **Ctrl/Cmd + ← →** or click thumbnails |
| Reorder steps | Drag thumbnails — blue drop-zone line shows where it will land |
| Add annotations | Arrow / Rectangle / Text / Blur / Spotlight tools on the left |
| Zoom into a region | Z tool → draw a box |
| Brand colors | 🎨 Brand → create a preset with your 6-color palette |
| Intro slide | ▶ Intro |
| Persistent CTA button | → CTA |
| Multiple projects | ☰ Projects → switch, create, or delete |

Changes autosave continuously. The pill in the top-right shows **Saved / Saving… / Unsaved / Error**.

---

## Export

Click **Export ZIP** → choose a brand preset (optional) → **Download ZIP**

The ZIP contains:
- `index.html` — self-contained player (all styles, JS, and step images embedded)
- `assets/step-NNN.png` — step screenshots
- `walkthrough.json` — machine-readable manifest (title, step count, export date)
- `netlify.toml` — `X-Frame-Options: ALLOWALL` so the player embeds via iframe

---

## Host on your site (Guide Dashboard)

The `guide-dashboard/` folder is a separate Netlify project that stores walkthroughs at stable URLs and generates iframe embed codes.

### Deploy the dashboard

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**
2. Connect this GitHub repo, set **Base directory** to `guide-dashboard/`
3. Build command: *(leave empty)* — Publish directory: `.`
4. Deploy

### Publish a walkthrough

1. Export a ZIP from the extension
2. Open your guide dashboard URL
3. Drop the ZIP onto the upload zone → enter a title and URL slug → **Publish Guide**
4. Copy the iframe embed code → paste into Framer, Webflow, Notion, or any HTML page

### Embed example

```html
<iframe
  src="https://your-dashboard.netlify.app/guides/my-walkthrough"
  title="Product Walkthrough"
  width="100%"
  height="600"
  frameborder="0"
  allowfullscreen
></iframe>
```

---

## Multi-project workflow

- Every **Start Recording** creates a new named project in local Chrome storage
- The **☰ Projects** menu in the editor lets you switch between saved projects
- The **📦 Deploys** button lets you paste published URLs against each project for tracking

---

## ⚠️ Dashboard security note

The guide dashboard currently has **no authentication** — anyone with the URL can upload or delete guides. Add Netlify Identity or basic-auth before sharing the dashboard URL publicly.

---

## v2.4 changelog

- **Capture quality** — recording indicator is hidden before each screenshot so it never appears in the captured image
- **Arrow-key nudge** — plain arrow keys nudge hotspot/annotation 0.5%; Shift+Arrow = 5%; Ctrl/Cmd+Arrow = step navigation
- **Multi-project storage** — each recording is its own project, nothing overwrites previous work
- **Recent projects in popup** — last 5 projects with step counts, one-click to open
- **Autosave indicator** — Saved / Saving / Unsaved / Error pill in editor header
- **Drop-zone indicators** — blue line shows exact insert point when reordering thumbnails
- **Deployment history** — paste published URLs against each project via 📦 Deploys
- **`walkthrough.json` manifest** — included in every export ZIP
- **Analytics scaffold** — player fires `track()` events via `sendBeacon` when an analytics endpoint is configured
- **Guide Dashboard** — new Netlify site for hosting walkthroughs at stable URLs with iframe embed codes
