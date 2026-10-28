// Public client config for the shared live mix. The publishable key is designed to be public;
// access is limited by Row Level Security (read state, update the single 'main' row only).
window.SIAGENTDJ_CONFIG = {
  supabaseUrl: "https://fyxofxprzffcdgbkdyax.supabase.co",
  supabaseKey: "sb_publishable_5o30X5hHJkjinb3hEl7xsQ_QbJqcFaD",
  stateTable: "mixer_state",
  stateId: "main",
  tracksTable: "dj_tracks",
  requestsTable: "song_requests",
  // Public listener avatar. Swap for the official art, e.g. "assets/dj-perfect.png".
  avatarSrc: "assets/dj-perfect.svg",
  supabaseJs: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm"
};
