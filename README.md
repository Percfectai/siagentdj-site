# siagentdj-site

**Org is Percfectai. Repo is Percfectai/siagentdj-site. Domain is siagentdj.com.**

nickpelectrical is not this project. Do not use that account, do not add it as a collaborator, and do not push to a nickpelectrical repo. The old percfectstudios tree is not this site.

Read `AGENTS.md` before changing anything.

The advertisement is Nick's decks playing Nick's tracks. The software is that same two-deck mixer with the AI built in. Anyone can use it with their own tracks, Nick's tracks, or both. A visitor cannot move the faders on the live advertisement. AI actions spend Percfect credits. Loading tracks is free. Do not add a second payment system.




Public listener page for siagentdj.com (DJ Perfect live), plus a private booth console.

**Domain:** [siagentdj.com](https://siagentdj.com) (also reachable at https://percfectai.github.io/siagentdj-site/ until DNS points at GitHub Pages)

## How deploys work

- Hosted on **GitHub Pages**, built from the `main` branch, root folder (`/`).
- Every push to `main` redeploys the site automatically (usually live within a minute or two).
- The `CNAME` file in the repo root sets the custom domain `siagentdj.com`. Don't delete it.
- Plain static HTML/CSS/JS, so there's no build step. Use relative links so the site works both on the custom domain and under `/siagentdj-site/`.

## Access and operations

- The deploy access token is a fine-grained GitHub token kept as an environment secret outside this repository. It is never committed here.
- Ops docs (hosting, DNS and where credentials live) are in a private repo.

## Sedo status (as of 2026-10-25)

- **Live for sale on Sedo:** perfectvault.si (Make Offer).
- **Pending Sedo ownership verification** (Make Offer, no price): percfectai.com, percfectsi.com, perfectnda.com, siagentdj.com, sishifts.com, pornvault.si, percfectproposal.com, perfectdoc.si, virtualdj.si, aiwatchbot.live, moviebot.si, perfecthero.si.
- **Likely verified, not yet confirmed live:** perfectdj.si, sibeatz.com.

### Note on virtualdj.si

virtualdj.si is registered and hosted at **Namecheap**, not GoDaddy. Its listing price is **$250,000**, unlike the other domains, which use the $20,000 placeholder floor. It is still pending Sedo ownership verification and needs the Sedo TXT record added at Namecheap: host `@`, value `3f1b9af7b6f8155af61f1f1348b8c5d2c31d1ed6`.

## Contact

founder@percfectai.com

## Shared live mix (Supabase)

Every visitor sees the same decks. State lives in Supabase (`config.js` holds the public URL and publishable key):

- `public.mixer_state` (single row `id='main'`): deck tracks (jsonb: name, title, url, bpm, key, playing), positions (seconds as of `extra.t`), tempo, EQ/kill/volume, FX, crossfader, sync. Anyone can read and update that row (no insert/delete); updates stream to all browsers via Supabase Realtime `postgres_changes`.
- `public.dj_tracks`: the shared track library (also mirrored in `tracks.json` as a fallback).
- Storage bucket `dj-tracks` (public read) holds the audio.

`live-sync.js` loads the state on page load, follows realtime updates, and writes local control changes back. If Supabase is unreachable the mixer still works locally.

Sync matches a track's native BPM to the master × ½, 1 or 2, whichever needs the smallest change, and applies it only within ±16%. Otherwise the deck stays at native tempo and the SYNC button shows "OUT OF RANGE".

## Pages

- `/` (`index.html` + `listener.js`): **public listener page**. No mixer controls. It follows `mixer_state` read-only over Realtime, plays the live decks from the public `dj-tracks` URLs at the synced position and tempo (after "Tap to listen", because browsers block autoplay), and shows the now-playing track and BPM. DJ Perfect stands over a CSS 3D booth and nods on the beat. The nod follows the live track's beat grid (BPM × tempo) and gets stronger with the audio level from a WebAudio AnalyserNode. "Play intro" and replies to requests use the browser's stock `speechSynthesis` voice.
- `/mixer.html`: the AI-driven two-deck mixer (the live AI example, with `?program=1` for studio mode). It runs locally in each browser and is not linked from the public page.
- `/booth-console.html`: **private two-deck mixer** (`noindex`, not linked from the public page). It writes the shared state through `live-sync.js`.

## Song requests

Requests are inserted into `public.song_requests` (columns `request` up to 200 chars and `listener_name` up to 40). Anon can only insert. It has no select, update or delete access, so visitors cannot read other people's requests. Read them in the Supabase dashboard or with the service role.

## Swapping in the official DJ Perfect art

`assets/dj-perfect.svg` is an original cartoon placeholder: tan fedora and overcoat, gold "BS" chain, headphones around the neck, pointing pose, and a "DJ biggAi Smalls" laptop. To use the official artwork:

1. Add the file, e.g. `assets/dj-perfect.png` (a transparent background works best, with the character cropped to the laptop at the bottom edge).
2. Set `avatarSrc: "assets/dj-perfect.png"` in `config.js`.

An SVG with a `<g id="head">` group gets a head-only nod, pivoting at the neck (200,228 in a 400×520 viewBox). Any other image nods as a whole, pivoting at the bottom.
