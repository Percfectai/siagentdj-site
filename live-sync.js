// Shared live-mix state for siagentdj.com.
// Every browser reads public.mixer_state (row 'main') on load, renders it, and follows
// Supabase Realtime postgres_changes. Local control changes write the whole deck state back.
const cfg = window.SIAGENTDJ_CONFIG || {};
const statusEl = document.getElementById("live-status");
const clientId = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2);
const decks = { 1: deck1, 2: deck2 };
const fxBtnEl = document.getElementById("fx-toggle");
const fxTypeEl = document.getElementById("fx-type");
const fxTargetEl = document.getElementById("fx-target");
const xfaderEl = document.getElementById("crossfader");

let sb = null;
let serverOffsetMs = 0;
let latestRow = null;
let lastRemoteT = 0;
let ready = false;
let writeTimer = null;
let writing = false;
let writeQueued = false;
let lastLocalChange = 0;

function setStatus(cls, text) {
  if (!statusEl) return;
  statusEl.className = "live-status " + cls;
  statusEl.textContent = text;
}
const serverNow = () => Date.now() + serverOffsetMs;

/* ---------------- snapshot (local -> row) ---------------- */
function deckSnapshot(d) {
  const fxOn = !!fxActive && (fxTargetEl.value === "master" || fxTargetEl.value === String(d.id));
  return {
    track: d.trackMeta ? { ...d.trackMeta, playing: d.isPlaying, duration: d.buffer ? d.buffer.duration : null } : null,
    position: d.buffer ? d.getCurrentPosition() : 0,
    tempo: d.playbackRate,
    eq: { hi: d.eq.hi, mid: d.eq.mid, low: d.eq.low, gain: d.eq.gain, color: d.eq.color, kill: { ...d.eq.kill }, vol: d.vol },
    fx: { on: fxOn, type: fxTypeEl.value, loop: d.isLooping ? { start: d.loopStart, end: d.loopEnd } : null, cue: d.cuePoint },
  };
}
function snapshot() {
  const a = deckSnapshot(deck1), b = deckSnapshot(deck2);
  const curve = document.querySelector('input[name="curve"]:checked').value;
  return {
    deck1_track: a.track, deck1_position: a.position, deck1_tempo: a.tempo, deck1_eq: a.eq, deck1_fx: a.fx,
    deck2_track: b.track, deck2_position: b.position, deck2_tempo: b.tempo, deck2_eq: b.eq, deck2_fx: b.fx,
    crossfader: parseFloat(xfaderEl.value),
    sync_on: { d1: deck1.syncOn, d2: deck2.syncOn, d1_info: deck1.syncOn ? deck1.syncInfo : null, d2_info: deck2.syncOn ? deck2.syncInfo : null },
    extra: { t: new Date(serverNow()).toISOString(), curve, fx: { on: !!fxActive, type: fxTypeEl.value, target: fxTargetEl.value } },
    client_id: clientId,
  };
}

async function flush() {
  writeTimer = null;
  if (!sb || !ready) return;
  if (writing) { writeQueued = true; return; }
  writing = true;
  try {
    const snap = snapshot();
    lastRemoteT = Date.parse(snap.extra.t);
    const { error } = await sb.from(cfg.stateTable).update(snap).eq("id", cfg.stateId);
    if (error) { console.warn("Live sync write failed:", error.message); setStatus("warn", "LIVE SYNC: WRITE FAILED"); }
    else setStatus("ok", "● LIVE SYNC");
  } catch (e) {
    console.warn("Live sync write failed:", e);
    setStatus("warn", "LIVE SYNC: WRITE FAILED");
  } finally {
    writing = false;
    if (writeQueued) { writeQueued = false; flush(); }
  }
}
function emit(immediate) {
  lastLocalChange = Date.now();
  if (!sb || !ready) return;
  if (immediate) { clearTimeout(writeTimer); flush(); }
  else if (!writeTimer) writeTimer = setTimeout(flush, 120);
}
window.__liveSync = { emit, clientId, get ready() { return ready; }, snapshot };

/* ---------------- apply (row -> local) ---------------- */
function applyDeck(n, row, tRef) {
  const d = decks[n];
  const track = row[`deck${n}_track`];
  const tempo = Number(row[`deck${n}_tempo`]) || 1;
  const eq = row[`deck${n}_eq`] || {};
  const fx = row[`deck${n}_fx`] || {};
  const sync = row.sync_on || {};

  d.eq = { hi: eq.hi || 0, mid: eq.mid || 0, low: eq.low || 0, gain: eq.gain || 0, color: eq.color || 0,
           kill: { hi: !!(eq.kill && eq.kill.hi), mid: !!(eq.kill && eq.kill.mid), low: !!(eq.kill && eq.kill.low) } };
  if (typeof eq.vol === "number") d.vol = eq.vol;
  d.applyEQ();
  d.renderMixerUI();
  d.syncOn = !!sync[`d${n}`];
  d.syncInfo = d.syncOn ? (sync[`d${n}_info`] || null) : null;

  if (!track) {
    if (d.trackMeta || d.loadingUrl) d.eject();
  } else if (!track.url) {
    const label = `${track.title || track.name} (DJ's local file, not shared)`;
    const same = d.trackMeta && d.trackMeta.local && d.trackMeta.name === track.name;
    if (!same && (d.trackMeta || d.dom.title.textContent !== label)) d.eject(label);
  } else if (!d.trackMeta || d.trackMeta.url !== track.url) {
    if (d.loadingUrl !== track.url) {
      d.loadFromUrl(track).then(ok => { if (ok && latestRow) applyRow(latestRow, true); });
    }
    return; // transport is applied once the audio is decoded
  }

  d.setRate(tempo, { propagate: false });
  d.renderSync();
  if (!d.buffer) return;

  if (fx.loop && fx.loop.end > fx.loop.start) { d.isLooping = true; d.loopStart = fx.loop.start; d.loopEnd = fx.loop.end; }
  else d.isLooping = false;
  if (typeof fx.cue === "number") d.cuePoint = fx.cue;

  const pos = Number(row[`deck${n}_position`]) || 0;
  let expected = pos + (track.playing ? Math.max(0, (serverNow() - tRef) / 1000) * tempo : 0);
  if (d.isLooping && expected >= d.loopEnd) {
    const len = d.loopEnd - d.loopStart;
    expected = d.loopStart + ((expected - d.loopStart) % len);
  }
  expected = Math.min(expected, d.buffer.duration);
  if (track.playing && expected < d.buffer.duration - 0.05) {
    if (!d.isPlaying) { d.pauseOffset = expected; d.play(); }
    else if (Math.abs(d.getCurrentPosition() - expected) > 0.3) d.seekTo(expected);
  } else {
    if (d.isPlaying) d.pause();
    if (Math.abs(d.pauseOffset - expected) > 0.02) d.pauseOffset = expected;
  }
}

function applyRow(row, force) {
  if (!row) return;
  latestRow = row;
  const tRef = Date.parse((row.extra && row.extra.t) || row.updated_at) || serverNow();
  if (!force) {
    if (row.client_id === clientId) return;       // our own echo
    if (tRef < lastRemoteT - 50) return;           // stale event
  }
  lastRemoteT = Math.max(lastRemoteT, tRef);
  window.__applyingRemote = true;
  try {
    const extra = row.extra || {};
    if (extra.curve) {
      const r = document.querySelector(`input[name="curve"][value="${extra.curve}"]`);
      if (r) r.checked = true;
    }
    if (typeof row.crossfader === "number") xfaderEl.value = String(row.crossfader);
    if (extra.fx) {
      fxActive = !!extra.fx.on;
      if (extra.fx.type) fxTypeEl.value = extra.fx.type;
      if (extra.fx.target) fxTargetEl.value = String(extra.fx.target);
    }
    applyDeck(1, row, tRef);
    applyDeck(2, row, tRef);
    updateCrossfader();
    applyFx();
    if (!window.__audioUnlocked && (deck1.isPlaying || deck2.isPlaying)) {
      document.getElementById("join-overlay").classList.add("show");
    }
  } catch (e) {
    console.warn("Live sync apply failed:", e);
  } finally {
    window.__applyingRemote = false;
  }
}

/* ---------------- library ---------------- */
async function loadLibrary() {
  let tracks = null;
  if (sb) {
    const { data, error } = await sb.from(cfg.tracksTable).select("name,title,url,bpm,musical_key,duration_s").order("sort");
    if (!error && data && data.length) tracks = data.map(t => ({ name: t.name, title: t.title, url: t.url, bpm: Number(t.bpm), key: t.musical_key, duration: Number(t.duration_s) }));
  }
  if (!tracks) {
    try { tracks = await (await fetch("tracks.json", { cache: "no-cache" })).json(); } catch (e) { tracks = []; }
  }
  [1, 2].forEach(n => {
    const sel = document.getElementById(`d${n}-track-select`);
    if (!sel) return;
    tracks.forEach(t => {
      const o = document.createElement("option");
      o.value = t.url;
      o.textContent = `${t.title} · ${Number(t.bpm).toFixed(1)} · ${t.key || "--"}`;
      o.dataset.meta = JSON.stringify(t);
      sel.appendChild(o);
    });
    const d = decks[n];
    if (d.trackMeta && d.trackMeta.url) sel.value = d.trackMeta.url;
  });
  window.__djLibrary = tracks;
}

async function measureClock() {
  try {
    const t0 = Date.now();
    const { data, error } = await sb.rpc("server_now");
    const t1 = Date.now();
    if (!error && data) serverOffsetMs = Date.parse(data) - (t0 + t1) / 2;
  } catch (e) { /* keep local clock */ }
}

async function fetchState() {
  const { data, error } = await sb.from(cfg.stateTable).select("*").eq("id", cfg.stateId).maybeSingle();
  if (error) throw error;
  return data;
}

async function start() {
  if (!cfg.supabaseUrl || !cfg.supabaseKey) { setStatus("err", "OFFLINE (LOCAL ONLY)"); await loadLibrary(); return; }
  let createClient;
  try { ({ createClient } = await import(cfg.supabaseJs)); }
  catch (e) { console.warn("Supabase client unavailable, running local-only:", e); setStatus("err", "OFFLINE (LOCAL ONLY)"); await loadLibrary(); return; }

  sb = createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  loadLibrary();
  await measureClock();
  try {
    const row = await fetchState();
    ready = true;
    if (row) applyRow(row, true);
    setStatus("warn", "LIVE SYNC: SUBSCRIBING…");
  } catch (e) {
    console.warn("Could not read shared mix state, running local-only:", e);
    setStatus("err", "OFFLINE (LOCAL ONLY)");
    return;
  }

  let firstSubscribe = true;
  sb.channel("mixer_state_main")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: cfg.stateTable, filter: `id=eq.${cfg.stateId}` },
        payload => applyRow(payload.new, false))
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setStatus("ok", "● LIVE SYNC");
        if (!firstSubscribe) { try { applyRow(await fetchState(), false); } catch (e) {} }
        firstSubscribe = false;
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setStatus("warn", "LIVE SYNC: RECONNECTING…");
      } else if (status === "CLOSED") {
        setStatus("err", "LIVE SYNC: DISCONNECTED");
      }
    });
}

document.getElementById("join-overlay").addEventListener("click", () => unlockAudio());
start();
