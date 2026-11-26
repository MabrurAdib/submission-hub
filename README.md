# Submission Hub (Offline-First PWA)

A lightweight, note-style Progressive Web App for tracking student assignment submissions and managing your local student database.

## Included Files
- `index.html` — Main app interface (Assignments Note Cards + Student Database tabs)
- `styles.css` — Responsive light/dark theme styling
- `app.js` — Offline `localStorage` persistence, Excel import/export, live ID lookup, BD 12h time & `dd/mm/yyyy` stamping, and entry/serial sorting
- `manifest.json` & `sw.js` — PWA installability and offline caching
- `icon.svg` — App icon

## How to Use
1. **Host or Open Locally:** Deploy to GitHub Pages / Cloudflare Pages (or serve via a local HTTP server) so the Service Worker caches everything for full offline use on Android and desktop.
2. **Import Students:** Go to the **Student Database** tab and import your `.xlsx` / `.xls` / `.csv` file with columns `Sl No.`, `ID`, and `Name`. IDs starting with `N2430` are automatically tagged `ELL-48`, and all others are tagged `Others`.
3. **Log Submissions:** Tap the **+** button in the **Assignments** tab, enter a title, type a 7-character ID to auto-match the student's name, and tap **Add** (or press **Enter**).
