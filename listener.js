// Public listener page for siagentdj.com.
// Read-only: follows public.mixer_state (row 'main') via Supabase Realtime and plays the live decks
// from the public dj-tracks bucket at the synced position. Never writes mixer state.
const cfg = window.SIAGENTDJ_CONFIG || {};
const $ = (id) => document.getElementById(id);
const statusEl = $("live-status");
const INTRO = "Yo, what up? It's your boy DJ Perfect in the house. We're ready to DJ any event. You just put your request here, and I'ma keep spinning records all night. You already know what it is. I'm repping A.I., S.I., and B.K. hard. You hear me, fam?";

let sb = null;
let row = null;
let serverOffsetMs = 0;
let listening = false;
let audioCtx = null, analyser = null, freqData = null, master = null;
const decks = { 1: { audio: null, gain: null, url: null }, 2: { audio: null, gain: null, url: null } };
const serverNow = () => Date.now() + serverOffsetMs;

function setStatus(cls, text) { statusEl.className = "live-pill " + cls; statusEl.textContent = text; }

/* ---------------- avatar ---------------- */
let headEl = null;
const avatarEl = $("avatar");
async function loadAvatar() {
  const src = cfg.avatarSrc || "assets/dj-perfect.svg";
  if (/\.svg(\?|$)/i.test(src)) {
    try {
      const txt = await (await fetch(src, { cache: "no-cache" })).text();
      if (txt.includes("<svg")) {
        avatarEl.innerHTML = txt;
        headEl = avatarEl.querySelector("#head");
        return;
      }
    } catch (e) { /* fall back to <img> */ }
  }
  const img = new Image();
  img.src = src; img.alt = "DJ Perfect";
  avatarEl.appendChild(img);
}

/* ---------------- state -> audio ---------------- */
function crossGains(x, curve) {
  if (curve === "linear") return [1 - x, x];
  if (curve === "scratch") return [x > 0.85 ? (1 - x) / 0.15 : 1, x < 0.15 ? x / 0.15 : 1];
  return [Math.cos(x * 0.5 * Math.PI), Math.cos((1 - x) * 0.5 * Math.PI)];
}

function deckInfo(n) {
  if (!row) return null;
  const track = row[`deck${n}_track`];
  if (!track || !track.url) return null;
  const tempo = Number(row[`deck${n}_tempo`]) || 1;
  const eq = row[`deck${n}_eq`] || {};
  const fx = row[`deck${n}_fx`] || {};
  const tRef = Date.parse((row.extra && row.extra.t) || row.updated_at) || serverNow();
  let pos = (Number(row[`deck${n}_position`]) || 0) + (track.playing ? Math.max(0, (serverNow() - tRef) / 1000) * tempo : 0);
  if (fx.loop && fx.loop.end > fx.loop.start && pos >= fx.loop.end) pos = fx.loop.start + ((pos - fx.loop.start) % (fx.loop.end - fx.loop.start));
  const dur = Number(track.duration) || Infinity;
  const playing = !!track.playing && pos < dur - 0.05;
  const [g1, g2] = crossGains(Number(row.crossfader ?? 0.5), (row.extra && row.extra.curve) || "smooth");
  const vol = typeof eq.vol === "number" ? eq.vol : 0.9;
  const gain = (n === 1 ? g1 : g2) * vol;
  return { n, track, tempo, pos: Math.min(pos, dur), playing, gain, bpm: (Number(track.bpm) || 0) * tempo };
}

function liveDeck() {
  const a = deckInfo(1), b = deckInfo(2);
  const cands = [a, b].filter(d => d && d.playing);
  if (!cands.length) return null;
  return cands.sort((x, y) => y.gain - x.gain)[0];
}

function ensureAudioGraph() {
  if (audioCtx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AC();
  master = audioCtx.createGain();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  freqData = new Uint8Array(analyser.frequencyBinCount);
  master.connect(analyser); analyser.connect(audioCtx.destination);
  [1, 2].forEach(n => {
    const a = new Audio();
    a.crossOrigin = "anonymous";
    a.preload = "auto";
    a.preservesPitch = false; a.mozPreservesPitch = false; a.webkitPreservesPitch = false;
    const src = audioCtx.createMediaElementSource(a);
    const g = audioCtx.createGain(); g.gain.value = 0;
    src.connect(g); g.connect(master);
    decks[n].audio = a; decks[n].gain = g;
  });
}

function syncAudio() {
  if (!listening || !audioCtx) return;
  [1, 2].forEach(n => {
    const d = decks[n], info = deckInfo(n);
    const a = d.audio;
    if (!info) { if (!a.paused) a.pause(); d.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05); return; }
    if (d.url !== info.track.url) { d.url = info.track.url; a.src = info.track.url; }
    d.gain.gain.setTargetAtTime(info.playing ? info.gain : 0, audioCtx.currentTime, 0.05);
    if (Math.abs(a.playbackRate - info.tempo) > 0.0005) a.playbackRate = info.tempo;
    if (info.playing) {
      if (a.readyState >= 1 && Math.abs(a.currentTime - info.pos) > 0.35) { try { a.currentTime = info.pos; } catch (e) {} }
      if (a.paused) { if (a.readyState < 1) a.addEventListener("loadedmetadata", () => syncAudio(), { once: true }); a.play().catch(() => {}); }
    } else if (!a.paused) a.pause();
  });
}

/* ---------------- now playing ---------------- */
function renderNowPlaying() {
  const live = liveDeck();
  const other = [deckInfo(1), deckInfo(2)].find(d => d && (!live || d.n !== live.n));
  if (live) {
    $("np-title").textContent = live.track.title || live.track.name;
    $("np-meta").innerHTML = `<b>${live.bpm.toFixed(1)} BPM</b> · Key ${live.track.key || "--"} · Deck ${live.n}`;
  } else {
    $("np-title").textContent = row ? "Between tracks…" : "Waiting for the DJ…";
    $("np-meta").innerHTML = "&nbsp;";
  }
  $("np-next").textContent = other ? `${other.playing ? "Mixing in" : "Up next"}: ${other.track.title || other.track.name}` : "";
  $("platter1").classList.toggle("on", !!(deckInfo(1) || {}).playing);
  $("platter2").classList.toggle("on", !!(deckInfo(2) || {}).playing);
  window.__listener = { live: live ? { deck: live.n, title: live.track.title, bpm: +live.bpm.toFixed(1) } : null, listening };
}

function onRow(r) {
  if (!r) return;
  row = r;
  renderNowPlaying();
  syncAudio();
}

/* ---------------- beat nod ---------------- */
const bars = [];
for (let i = 0; i < 16; i++) { const b = document.createElement("i"); $("eqbars").appendChild(b); bars.push(b); }
let level = 0;
function frame() {
  const live = liveDeck();
  let amp = 0;
  if (analyser && listening) {
    analyser.getByteFrequencyData(freqData);
    let lo = 0; for (let i = 0; i < 12; i++) lo += freqData[i];
    amp = lo / (12 * 255);
    bars.forEach((b, i) => { b.style.height = (6 + (freqData[i * 6] / 255) * 34) + "px"; });
  } else {
    bars.forEach((b, i) => { b.style.height = live ? (6 + Math.abs(Math.sin(performance.now() / 180 + i)) * 20) + "px" : "6px"; });
  }
  level += (amp - level) * 0.25;
  let angle = 0, bob = 0;
  if (live && live.track.bpm) {
    const beats = live.pos * (Number(live.track.bpm) / 60);   // beat grid from the track's position
    const phase = beats - Math.floor(beats);
    const hit = Math.exp(-phase * 6);                           // sharp nod on the beat, ease back
    const strength = listening ? 0.45 + level * 1.6 : 0.8;
    angle = 9 * hit * strength;
    bob = 5 * hit * strength;
  } else {
    angle = Math.sin(performance.now() / 900) * 1.5;            // idle sway
  }
  if (headEl) headEl.style.transform = `rotate(${angle.toFixed(2)}deg)`;
  else avatarEl.style.transform = `translateX(-50%) rotate(${(angle * 0.35).toFixed(2)}deg)`;
  avatarEl.style.translate = `0 ${bob.toFixed(1)}px`;
  window.__nod = { angle: +angle.toFixed(2), level: +level.toFixed(3) };
  requestAnimationFrame(frame);
}

/* ---------------- voice ---------------- */
let bubbleTimer = null;
function say(text) {
  const bubble = $("bubble");
  bubble.textContent = text;
  bubble.classList.add("show");
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove("show"), Math.max(4000, text.length * 75));
  if (!("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const v = voices.find(v => /en[-_]US/i.test(v.lang) && /male|guy|david|mark|fred/i.test(v.name)) || voices.find(v => /^en/i.test(v.lang));
    if (v) u.voice = v;
    u.rate = 1.02; u.pitch = 0.85;
    if (master && audioCtx) {
      u.onstart = () => master.gain.setTargetAtTime(0.35, audioCtx.currentTime, 0.1);   // duck the music
      u.onend = u.onerror = () => master.gain.setTargetAtTime(1, audioCtx.currentTime, 0.2);
    }
    speechSynthesis.speak(u);
  } catch (e) { /* text bubble still shows */ }
}
let introPlayed = false;
function playIntro() { introPlayed = true; say(INTRO); }

/* ---------------- requests ---------------- */
const REPLIES = [
  (s) => `Say less fam, I got you. "${s}" is going on the next drop.`,
  (s) => `"${s}"? Oh, you got taste! I'ma line that up right after this one.`,
  (s) => `Yo, "${s}" request locked in. Brooklyn, make some noise!`,
  (s) => `I hear you, fam. "${s}" coming up. Keep it locked right here.`,
  (s) => `"${s}"! That's a vibe. DJ Perfect's got you on the next blend.`,
];
let lastReq = 0;
$("req-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const song = $("req-song").value.trim().slice(0, 200);
  const name = $("req-name").value.trim().slice(0, 40);
  const hint = $("req-hint");
  if (!song) return;
  if (Date.now() - lastReq < 5000) { hint.textContent = "Easy, fam. One request every few seconds."; return; }
  lastReq = Date.now();
  const reply = REPLIES[Math.floor(Math.random() * REPLIES.length)](song) + (name ? ` Shout out ${name}!` : "");
  say(reply);
  $("req-song").value = "";
  hint.textContent = "Request sent to the booth.";
  if (sb) {
    try {
      const { error } = await sb.from(cfg.requestsTable || "song_requests").insert({ request: song, listener_name: name || null });
      if (error) { hint.textContent = "DJ Perfect heard you (request not saved)."; }
    } catch (err) { hint.textContent = "DJ Perfect heard you (request not saved)."; }
  }
});

/* ---------------- listen / intro buttons ---------------- */
function startListening() {
  ensureAudioGraph();
  if (audioCtx.state === "suspended") audioCtx.resume();
  listening = true;
  const btn = $("listen-btn");
  btn.textContent = "🔊 Listening live"; btn.classList.add("listening");
  syncAudio();
}
function stopListening() {
  listening = false;
  [1, 2].forEach(n => { const a = decks[n].audio; if (a && !a.paused) a.pause(); });
  const btn = $("listen-btn");
  btn.textContent = "▶ Tap to listen"; btn.classList.remove("listening");
}
$("listen-btn").addEventListener("click", () => {
  if (listening) { stopListening(); return; }
  startListening();
  if (!introPlayed) playIntro();
});
$("intro-btn").addEventListener("click", () => { if (!listening) startListening(); playIntro(); });
// Try the intro on the first interaction anywhere (browsers block speech/audio before a gesture).
document.addEventListener("pointerdown", function first(e) {
  document.removeEventListener("pointerdown", first, true);
  if (!introPlayed && !e.target.closest("button,input,form")) playIntro();
}, true);

/* ---------------- Supabase ---------------- */
async function start() {
  loadAvatar();
  requestAnimationFrame(frame);
  setInterval(() => { renderNowPlaying(); syncAudio(); }, 1000);
  if (!cfg.supabaseUrl || !cfg.supabaseKey) { setStatus("warn", "OFFLINE"); return; }
  let createClient;
  try { ({ createClient } = await import(cfg.supabaseJs)); }
  catch (e) { console.warn("Supabase client unavailable:", e); setStatus("warn", "OFFLINE"); return; }
  sb = createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const t0 = Date.now(); const { data } = await sb.rpc("server_now"); const t1 = Date.now();
    if (data) serverOffsetMs = Date.parse(data) - (t0 + t1) / 2;
  } catch (e) { /* local clock */ }
  const fetchRow = async () => {
    const { data, error } = await sb.from(cfg.stateTable).select("*").eq("id", cfg.stateId).maybeSingle();
    if (error) throw error;
    return data;
  };
  try { onRow(await fetchRow()); }
  catch (e) { console.warn("Could not read live mix state:", e); setStatus("warn", "OFFLINE"); }
  let first = true;
  sb.channel("listener_" + Math.random().toString(36).slice(2))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: cfg.stateTable, filter: `id=eq.${cfg.stateId}` }, (p) => onRow(p.new))
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setStatus("ok", "LIVE");
        if (!first) { try { onRow(await fetchRow()); } catch (e) {} }
        first = false;
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setStatus("warn", "RECONNECTING…");
      else if (status === "CLOSED") setStatus("warn", "DISCONNECTED");
    });
}
start();
