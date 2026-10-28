# Agents

The GitHub organization is Percfectai. This repository is Percfectai/siagentdj-site. The site is https://siagentdj.com.

nickpelectrical, Nick B Electrical, and percfectstudios are the wrong names. Do not mention them as the owner, do not reconnect GitHub to that account, and do not ask Nick to add that account as a collaborator. GitHub is already connected as Percfectai. Pushes to main deploy GitHub Pages. Leave the CNAME file in place.

## Two products, not one mixer

1. The app, for anybody. Advertise it this way: load your own songs onto the decks and let an AI help you mix. Each person gets their own session. Their tracks and faders never write into someone else's session, and never into Nick's live set.
2. The live show, for Nick. Visitors hear the broadcast and see the DJ avatar. They do not see or move Nick's decks.

A shared `mixer_state` row with public write is the wrong design. That lets a stranger hijack the live decks. The anon key may read the broadcast. It must not be able to change Nick's decks. A visitor's own mix stays in their browser until an upload path exists, and even then it is stored under that visitor, not on the live row.

## What is not built

Uploading a song does not save it to Supabase yet. A file dropped in the browser stays in that tab.

Do not say Supabase policies are done until two browsers have been tested. Nick's browser can run the live decks. A stranger's browser can open the app, load their own songs, and use the AI on those songs, and cannot move Nick's faders.

## Contact

founder@percfectai.com
