# Grandad's Play & Learn — Family Prototype v2

An iPad-friendly Progressive Web App for children aged roughly 18 months to 5 years.

## Included in this version
- Personal grandparent name (for example, **Boepa**) while retaining the product name **Grandad's Play & Learn**.
- Multiple child profiles with individual ages and progress.
- Adaptive difficulty by age band.
- Four working games:
  1. **[Name] Says** — colours, shapes, animals and numbers.
  2. **Animal Sounds** — listen to a sound cue and identify the animal.
  3. **Feed the Monster** — count by feeding the requested number of items.
  4. **Match & Remember** — progressively larger matching-card games.
- Grown-ups area protected by a simple arithmetic gate.
- Per-child play counts and accuracy/progress summaries.
- Voice Studio: record personalised praise and try-again messages using the device microphone.
- Browser speech prompts when a recorded voice clip is not available.
- Local-only storage: profiles, progress and voice clips remain on the device/browser.
- PWA manifest and service worker for Home Screen/offline-style use once hosted.

## Run locally
From this folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

## iPad note
For microphone recording and reliable Home Screen/PWA behaviour, host the project over HTTPS (Vercel, Netlify, Cloudflare Pages, GitHub Pages, etc.). Safari will request microphone permission the first time Voice Studio records.

## Good next additions
- Family-photo recognition game.
- Letter tracing and early phonics.
- More natural pre-recorded vocabulary packs.
- Interests/themes such as dinosaurs, vehicles, space and football.
- Optional cloud family sync with a parent account.
- Session timer / gentle “all finished” screen.


## Version 3 additions
- Our Family photo/name recognition game and grown-up family photo manager
- Letters & Phonics game with A-Z picture vocabulary
- Finger tracing canvas for A-Z letters
- Progress tracking for all three new learning areas

Family photos and progress are stored locally in the browser. Keep uploaded photos reasonably small because browser local storage is limited.


## Version 4 visual refresh
- Completely redesigned illustrated-style home dashboard
- Large responsive child greeting: “Brilliant, [name]!”
- Longer names wrap instead of being clipped
- Boepa mascot area and speech bubble
- 4-column iPad layout, responsive to phones/tablets
- Colour-coded game cards with level strips
- My Progress card and quick controls
- Existing v3 games, profiles, family photos, voice studio and progress data retained
