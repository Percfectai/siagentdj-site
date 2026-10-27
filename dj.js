/* ==========================================================================
   AI DJ CRATE DIGGER & AUTONOMOUS PERFORMANCE ENGINE
   ========================================================================== */
class AICrateDigger {
  constructor() {
    this.tracks = []; // Array of { file, name, size, played: false, bpm: null }
    this.history = [];
  }

  loadFiles(fileList) {
    this.tracks = [];
    const validExtensions = [".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"];
    
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const lower = f.name.toLowerCase();
      if (validExtensions.some(ext => lower.endsWith(ext))) {
        this.tracks.push({
          id: i,
          file: f,
          name: f.name.replace(/\.[^/.]+$/, ""),
          played: false,
          bpm: null
        });
      }
    }
    return this.tracks.length;
  }

  getUnplayedTracks() {
    return this.tracks.filter(t => !t.played);
  }

  /* Core DJ Decision Algorithm: Select next track based on current room state */
  chooseNextTrack(targetBpm, strategy = "harmonic") {
    const pool = this.getUnplayedTracks();
    if (pool.length === 0) {
      // If we burnt through the crate, reset played history to keep party moving
      this.tracks.forEach(t => t.played = false);
      return this.tracks[0];
    }

    if (strategy === "sequential") {
      return pool[0];
    }

    if (strategy === "shuffle") {
      const idx = Math.floor(Math.random() * pool.length);
      return pool[idx];
    }

    if (strategy === "energy_build") {
      // Find track with slightly higher BPM (+1 to +3 BPM) for building tension
      const candidates = pool.filter(t => t.bpm && t.bpm >= targetBpm && t.bpm <= targetBpm + 6);
      if (candidates.length > 0) return candidates[0];
    }

    // Default: "harmonic" / Proximity
    // If tracks have been pre-analyzed, pick closest tempo within +/- 6% pitch tolerance
    let bestTrack = pool[0];
    let minDiff = 999;

    for (const t of pool) {
      if (t.bpm) {
        const diff = Math.abs(t.bpm - targetBpm);
        if (diff < minDiff) {
          minDiff = diff;
          bestTrack = t;
        }
      }
    }
    return bestTrack;
  }

  markPlayed(track) {
    track.played = true;
    this.history.push(track);
  }
}

class AutonomousDJEngine {
  constructor(d1, d2) {
    this.deckA = d1;
    this.deckB = d2;
    this.crate = new AICrateDigger();
    this.activeDeck = 1;      // On air
    this.incomingDeck = 2;    // Staged on monitor
    this.state = "IDLE";      // IDLE | PREPPING_DECK | READY_TO_DROP | INTRODUCING | BASS_SWAP | OUTRO_SWEEP
    this.isEnabled = false;
    this.lastProcessedBeat = -1;
    this.currentTrackA = null;
    this.currentTrackB = null;

    // HUD bindings
    this.hudStatus = document.getElementById("ai-agent-status");
    this.hudAction = document.getElementById("ai-next-action");
    this.hudPhrase = document.getElementById("ai-phrase-counter");
    this.hudLead   = document.getElementById("ai-lead-deck");
    this.hudStats  = document.getElementById("ai-crate-stats");
    this.hudStrip  = document.getElementById("ai-crate-strip");
    this.toggleBtn = document.getElementById("ai-agent-toggle");
    this.stratSelector = document.getElementById("ai-selection-strategy");

    this.initListeners();
  }

  log(msg, type = "info") {
    const time = new Date().toTimeString().split(' ')[0];
    const color = type === "warn" ? "#ff3344" : type === "action" ? "#00f0ff" : "#00e676";
    console.log(`%c[AI DJ BOOTH ${time}] ${msg}`, `color: ${color}; font-weight: bold;`);
    if (this.hudAction) this.hudAction.textContent = msg.toUpperCase();
  }

  initListeners() {
    // Folder Input
    document.getElementById("ai-folder-input").addEventListener("change", (e) => {
      const count = this.crate.loadFiles(e.target.files);
      if (count === 0) {
        alert("No supported audio tracks (.mp3, .wav, .m4a, .aac, .flac) found in this folder.");
        return;
      }
      this.hudStats.textContent = `${count} Tracks Available`;
      this.hudStatus.textContent = `CRATE LOADED: ${count} TRACKS READY`;
      this.hudStatus.style.color = "var(--accent-cyan)";
      this.log(`Loaded directory with ${count} tracks into the crate. Analyzing crate pool.`);
      this.renderCrateStrip();
    });

    // Auto-DJ Engage Toggle
    this.toggleBtn.addEventListener("click", () => {
      if (this.crate.tracks.length === 0) {
        alert("Select a music folder first so I have tracks to play from!");
        return;
      }
      this.isEnabled = !this.isEnabled;
      if (this.isEnabled) {
        this.toggleBtn.textContent = "⏹ DISENGAGE AI DJ";
        this.toggleBtn.style.background = "#3d1318";
        this.toggleBtn.style.borderColor = "#ff3344";
        this.toggleBtn.style.color = "#ff3344";
        this.hudStatus.textContent = "STATUS: LIVE (AUTONOMOUS CRATE SELECTOR & MIXER)";
        this.hudStatus.style.color = "#00e676";
        this.tick();
      } else {
        this.toggleBtn.textContent = "▶ ENGAGE AI AUTONOMOUS CRATE MIXER";
        this.toggleBtn.style.background = "#11281c";
        this.toggleBtn.style.borderColor = "#00e676";
        this.toggleBtn.style.color = "#00e676";
        this.hudStatus.textContent = "STATUS: STANDBY";
        this.hudStatus.style.color = "#60687a";
      }
    });
  }

  renderCrateStrip() {
    this.hudStrip.innerHTML = "";
    this.crate.tracks.forEach(t => {
      const tag = document.createElement("span");
      tag.style.cssText = `
        padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 700;
        background: ${t.played ? "#1c1e24" : "#1a2233"};
        color: ${t.played ? "#555b6d" : "var(--accent-cyan)"};
        border: 1px solid ${t.played ? "#252833" : "#2d3e5e"};
      `;
      tag.textContent = (t.played ? "✓ " : "") + t.name;
      this.hudStrip.appendChild(tag);
    });
  }

  getDeck(num) {
    return num === 1 ? this.deckA : this.deckB;
  }

  tick() {
    if (!this.isEnabled) return;
    requestAnimationFrame(() => this.tick());

    const outDeck = this.getDeck(this.activeDeck);
    const inDeck  = this.getDeck(this.incomingDeck);

    // Initial Set Bootstrapping: Start Deck 1 if board is silent
    if (!outDeck.buffer && this.crate.tracks.length > 0) {
      const firstTrack = this.crate.chooseNextTrack(128.0, "sequential");
      this.log(`Loading Opening Track '${firstTrack.name}' onto Deck ${this.activeDeck}.`, "action");
      outDeck.loadAudioBuffer(firstTrack.file);
      this.crate.markPlayed(firstTrack);
      this.renderCrateStrip();
      setTimeout(() => { outDeck.play(); }, 500);
      return;
    }

    if (!outDeck.buffer || !outDeck.isPlaying) return;

    // Track time and calculate phrasing
    const curTime = outDeck.getCurrentPosition();
    const duration = outDeck.buffer.duration;
    const timeLeft = duration - curTime;
    const beatSec = 60 / (outDeck.detectedBpm * outDeck.playbackRate);
    const totalBeats = Math.floor(curTime / beatSec);
    const beatInPhrase = totalBeats % 128;

    this.hudPhrase.textContent = `${(beatInPhrase % 32) + 1} / 32 (Bar ${Math.floor(beatInPhrase / 4) + 1})`;

    // STEP 1: When 55 seconds remain, autonomously select & load the next track from folder into the idle deck
    if (timeLeft <= 55 && !inDeck.buffer && this.state === "IDLE") {
      this.stageNextTrackFromCrate(outDeck, inDeck);
    }

    // STEP 2: When 36 seconds remain, sync tempo, cue, and lock to phrase downbeat
    if (timeLeft <= 36 && inDeck.buffer && this.state === "PREPPED") {
      this.state = "WAITING_DOWNBEAT";
      this.log(`Incoming Track ready on Deck ${this.incomingDeck}. Locking on downbeat phrase hit.`, "action");
    }

    // STEP 3: Drop incoming track on bar 1 of a phrase boundary
    if (this.state === "WAITING_DOWNBEAT") {
      if (beatInPhrase % 32 === 0 && beatInPhrase !== this.lastProcessedBeat) {
        this.lastProcessedBeat = beatInPhrase;
        this.dropIncomingDeck(outDeck, inDeck, totalBeats);
      }
    }

    // STEP 4: 8-bar Smooth EQ intro blend
    if (this.state === "INTRODUCING") {
      this.blendIncomingTrack(outDeck, inDeck, totalBeats);
    }

    // STEP 5: Precise downbeat Bass Swap on the 1 of next 32-beat phrase
    if (this.state === "BASS_SWAP") {
      if (beatInPhrase % 32 === 0 && beatInPhrase !== this.lastProcessedBeat) {
        this.lastProcessedBeat = beatInPhrase;
        this.executeInstantBassSwap(outDeck, inDeck);
      }
    }

    // STEP 6: Outro filter sweep & deck swap
    if (this.state === "OUTRO_SWEEP") {
      this.evacuateOutgoingTrack(outDeck, inDeck);
    }
  }

  /* Dig through the folder and load onto the idle deck */
  stageNextTrackFromCrate(outDeck, inDeck) {
    const strat = this.stratSelector.value;
    const currentBpm = outDeck.detectedBpm * outDeck.playbackRate;
    const selected = this.crate.chooseNextTrack(currentBpm, strat);

    this.log(`Crate Engine selected: '${selected.name}' for Deck ${this.incomingDeck} using ${strat.toUpperCase()}.`, "action");
    
    // Load audio buffer into idle deck
    inDeck.loadAudioBuffer(selected.file);
    this.crate.markPlayed(selected);
    this.renderCrateStrip();

    // Reset incoming channel state
    inDeck.dom.volFader.value = 0;
    if (inDeck.deckGain) inDeck.deckGain.gain.value = 0;

    this.state = "PREPPED";
  }

  dropIncomingDeck(outDeck, inDeck, totalBeats) {
    this.log(`Downbeat phrase hit. Syncing Deck ${this.incomingDeck} and launching intro.`, "action");

    // Lock tempo
    inDeck.playbackRate = (outDeck.detectedBpm * outDeck.playbackRate) / inDeck.detectedBpm;
    inDeck.dom.pitch.value = inDeck.playbackRate;
    inDeck.dom.pitch.dispatchEvent(new Event('input'));

    // Safe Frequency Staging: Lows killed, Mids tucked (-3dB), Highs open
    inDeck.highFilter.gain.value = 0;
    inDeck.midFilter.gain.value = -3;
    inDeck.lowFilter.gain.value = -100; // Sub completely killed

    inDeck.play();
    this.transitionStartBeat = totalBeats;
    this.state = "INTRODUCING";
  }

  blendIncomingTrack(outDeck, inDeck, totalBeats) {
    const elapsed = totalBeats - this.transitionStartBeat;
    const progress = Math.min(1.0, elapsed / 32); // 8 bars (32 beats)

    const targetVol = progress * 0.9;
    inDeck.dom.volFader.value = targetVol;
    if (inDeck.deckGain) inDeck.deckGain.gain.value = targetVol;

    // Bring incoming mids up
    inDeck.midFilter.gain.value = -3 + (progress * 3);
    // Duck outgoing highs to avoid cymbal clash
    outDeck.highFilter.gain.value = -(progress * 4);

    if (progress >= 1.0) {
      this.state = "BASS_SWAP";
      this.log(`8 bars blended. Primed for downbeat Bass Swap.`, "action");
    }
  }

  executeInstantBassSwap(outDeck, inDeck) {
    this.log(`PHRASE DROP: Swapping Bass. Cutting Deck ${this.activeDeck} Lows -> Punching Deck ${this.incomingDeck} Lows to 0dB.`, "action");
    
    // Kill outgoing sub; open incoming sub
    outDeck.lowFilter.gain.value = -100;
    inDeck.lowFilter.gain.value = 0;

    inDeck.dom.volFader.value = 0.9;
    if (inDeck.deckGain) inDeck.deckGain.gain.value = 0.9;

    this.state = "OUTRO_SWEEP";
  }

  evacuateOutgoingTrack(outDeck, inDeck) {
    outDeck.colorFilter.type = "highpass";
    const curHPF = outDeck.colorFilter.frequency.value || 20;

    if (curHPF < 7500) {
      outDeck.colorFilter.frequency.value = curHPF + 45;
      outDeck.dom.volFader.value = Math.max(0, outDeck.dom.volFader.value - 0.005);
      if (outDeck.deckGain) outDeck.deckGain.gain.value = outDeck.dom.volFader.value;
    } else {
      // Outgoing track completely evacuated
      outDeck.pause();
      outDeck.buffer = null; // Free up deck for next crate load
      outDeck.colorFilter.type = "allpass";
      outDeck.colorFilter.frequency.value = 20;
      outDeck.lowFilter.gain.value = 0;
      outDeck.midFilter.gain.value = 0;
      outDeck.highFilter.gain.value = 0;

      this.log(`Transition complete. Handing over Master to Deck ${this.incomingDeck}.`, "action");

      // Swap roles
      const previousMaster = this.activeDeck;
      this.activeDeck = this.incomingDeck;
      this.incomingDeck = previousMaster;

      this.hudLead.textContent = `CH ${this.activeDeck}`;
      this.hudLead.style.color = this.activeDeck === 1 ? "var(--accent-cyan)" : "var(--accent-orange)";

      this.state = "IDLE";
      this.log(`Deck ${this.activeDeck} is rocking the room. Monitoring for next folder selection window.`);
    }
  }
}

// Spin up the Autonomous DJ Engine
const aiDJ = new AutonomousDJEngine(deck1, deck2);