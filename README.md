# Grandad's Play & Learn — v5

An iPad-friendly Progressive Web App of learning games for children aged roughly 18 months to 5 years,
narrated in a grandparent's own recorded voice.

Everything stays on the device: profiles, progress, family photos and voice recordings are held in the
browser's local storage. Nothing is uploaded anywhere. No adverts, no outside links.

## The games
1. **[Name] Says** — colours, shapes, animals and numbers.
2. **Animal Sounds** — hear a sound, find the animal.
3. **Feed the Monster** — counting, with the app counting aloud as you feed.
4. **Match & Remember** — pairs, growing with age.
5. **Our Family** — recognise family photos by name or relationship.
6. **Letters & Phonics** — A–Z with a picture word for each letter.
7. **Tracing** — draw letters with a finger.

Difficulty adapts to each child's age band (under 2½ / under 4 / 4+): fewer choices and smaller
numbers for the youngest.

## What changed in v5

v4.2 worked but felt clunky. Almost all of that came from four things, now fixed.

### It felt unresponsive
- **Taps no longer rebuild the whole screen.** v4 called `innerHTML` on the entire app after every
  single tap, which caused a visible flash, made animation impossible, and wiped the child's drawing
  in Tracing. v5 updates only the part that changed.
- **Every tap now has instant feedback**: a sound effect, the button popping green or shaking red,
  and a burst of stars on a correct answer.
- **Double-taps can't score twice or skip a round** — the answer row locks while praise is playing.

### The sound was unreliable
- **Speech now works on iPad from the first question.** iOS only allows speech after a real user
  gesture; v4 never did that, so prompts were silent until you pressed "Say it again".
- **Audio can no longer freeze permanently.** v4's speech queue had no timeout, so a single utterance
  that failed to report finishing (a known Safari bug) would silently kill every later prompt.
- **The 🔊 button actually mutes now.** In v4 it was a dead control that only spoke a test phrase.
- **Voices load properly**, so the warm British voice is used from the start rather than whatever
  default the device picked before the voice list had loaded.

### Rounds never ended
- Games now run to a **set number of stars** (5 by default) and finish on a "You did it!" screen with
  *Play again* / *Choose another game*. Adjustable in Grown-ups to 5, 10, or keep going.
- After two wrong answers the correct choice **gently pulses** as a hint, so a child can't get stuck.

### Deploys didn't reach the iPad
- The service worker now takes over immediately (`skipWaiting` + `clients.claim`) and prefers the
  network for code. v4 was cache-first with no update path, so an iPad could stay on an old version
  for days after a deploy. The app still works fully offline.

### Bugs fixed
- `gameTile()` was **defined twice**, so the "★ Level" strips never rendered.
- The home screen's star count read the wrong object and **always showed 0**.
- "Feed me 4 **strawberrys**" → "4 strawberries".
- The ⭐ counter lagged a round behind, and never moved at all in Match & Remember.
- **Boepa Says** cut its own praise off — it used a fixed timer instead of waiting for speech, the
  very thing v4.1 was meant to fix.
- Letters & Phonics played no "try again" clip on a wrong answer, unlike every other game.
- Tracing measured **stroke events** rather than distance, so a quick confident swipe was rejected;
  it also lost the drawing whenever the "not yet" message appeared, and stopped drawing if a finger
  strayed off the canvas.
- The speech bubble was clipped off the left edge on phones narrower than about 400px.
- Reset progress now asks for confirmation before wiping a child's stars.

### Features the v4 README promised but didn't ship
The v4.2/v4.3 notes described a voice picker, a Test Voice button and an Adult Voice Pack. The
stylesheet had rules for them but the code was never written. All three are now real:
- **Question voice** picker plus **Test voice** in Grown-ups, remembered on the device.
- **Voice studio** now records six lines instead of two — three "well done"s, two "try again"s and an
  end-of-game message. Where more than one is recorded the app **picks a different one each time**,
  so a child doesn't hear the same clip forty times in a row. Recording auto-stops after 8 seconds.

### Making it yours (and the other grandad's)
- **The face on the home screen can be your own photo.** Grown-ups → Family setup → *Your picture*.
  `boepa-mascot.png` is a stock cartoon and stays as the fallback if no photo is set. Because it is
  stored per device, each grandad gets his own face, his own name and his own voice on his own iPad.
- The first-run "What do the children call you?" box is now **empty with a placeholder** rather than
  pre-filled with "Boepa", so a second grandad isn't typing over someone else's name.

### Backup and restore
Grown-ups → Backup writes **one `.json` file** holding profiles, progress, the home-screen photo,
family photos and every voice recording. Restore reads it back after confirming what it contains
(date, children, number of recordings). Nothing is uploaded; the file goes wherever you save it.

This matters more than it sounds. Everything lives in browser storage, and **Safari clears
script-writable storage for sites you haven't opened in 7 days** — which would take the voice
recordings with it. Adding the app to the iPad Home Screen exempts it from that; a backup covers the
rest (a wiped device, a new iPad, or copying a setup between the two grandads).

> **Set it up from the Home Screen icon, not from Safari.** On iPad a Home Screen web app gets its own
> storage container. Recordings made in Safari won't appear once it's added to the Home Screen.

### Storage
Family photos and the home-screen photo are **shrunk to a small square JPEG** before saving (roughly 40KB each instead of
several megabytes), so the browser's storage limit is no longer easy to hit. If a save does fail, the
app now says so plainly and rolls back instead of losing data silently.

## Run locally
From this folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Hosting
Microphone recording and Home Screen/PWA behaviour need HTTPS. Vercel, Netlify, Cloudflare Pages and
GitHub Pages all work. Safari asks for microphone permission the first time you record.

## Data kept on the device
| Key | Contents |
| --- | --- |
| `gpl-data-v2` | Grandparent name and photo, child profiles, progress |
| `gpl-prefs-v1` | Sound on/off, chosen voice, game length |
| `gpl-audio-v1` | Recorded voice clips |
| `gpl-family-v1` | Family names, relationships and photos |

v4.2 data is read unchanged, so upgrading keeps every profile, star and recording.

## Ideas for next time
- Family-photo game extended to short recorded greetings per person.
- Interest themes: dinosaurs, vehicles, space, football.
- Optional cloud family sync so both grandads share one set of recordings.
- Letter formation guides (arrows and start dots) in Tracing.
