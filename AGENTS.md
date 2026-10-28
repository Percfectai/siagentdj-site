# Agents

The GitHub organization is Percfectai. This repository is Percfectai/siagentdj-site. The site is https://siagentdj.com.

nickpelectrical, Nick B Electrical, and percfectstudios are the wrong names. Do not mention them as the owner, do not reconnect GitHub to that account, and do not ask Nick to add that account as a collaborator. GitHub is already connected as Percfectai. Pushes to main deploy GitHub Pages. Leave the CNAME file in place.

## Two products, not one mixer

1. The app, for anybody. Advertise it this way: load your own songs onto the decks and let an AI help you mix. Each person gets their own session. Their tracks and faders never write into someone else's session, and never into Nick's live set.
2. The live show, for Nick. Visitors hear the broadcast and see the DJ avatar. They do not see or move Nick's decks.

A shared `mixer_state` row with public write is the wrong design. That lets a stranger hijack the live decks. The anon key may read the broadcast. It must not be able to change Nick's decks. A visitor's own mix stays in their browser until an upload path exists, and even then it is stored under that visitor, not on the live row.

## Money

The application is free to open. Putting songs on the decks by hand is free. The AI integration is the paid product.

Charge Percfect credits for AI actions: tempo match, transition, auto-mix, and an AI pass that moves the faders. Use the existing Percfect credit wallet and Stripe packs. Do not invent a second cashier. Do not grant credits on a zero-dollar checkout.

Do not advertise the paid AI as live until a real Stripe charge grants credits once, the webhook secret is set, and a refresh does not grant those credits again.

The live show is not a meter. Strangers do not pay to hear it, and they do not spend credits to touch Nick's decks.

## What is not built

Uploading a song does not save it to Supabase yet. A file dropped in the browser stays in that tab.

Do not say Supabase policies are done until two browsers have been tested. Nick's browser can run the live decks. A stranger's browser can open the app, load their own songs, and use the AI on those songs only after credits are spent, and cannot move Nick's faders.

## Contact

founder@percfectai.com
