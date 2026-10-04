import re

with open("src/lobby.ts", "r", encoding="utf-8") as f:
    content = f.read()

# ==============================================================
# 1. Replace the HUD HTML to add a ROUND TIMER column (right side)
#    and rename "NEXT PHASE" to "ROUND TIMER"
# ==============================================================
old_hud = '''hud.innerHTML = `
      <div class="flex items-stretch gap-0">
        <!-- Phase Name + Label -->
        <div class="flex flex-col justify-center px-4 py-2 border-r border-neon-yellow/25 min-w-[160px]">
          <span class="text-[9px] font-pixel tracking-widest text-gray-400 uppercase">PHASE</span>
          <span id="br-phase" class="text-neon-yellow font-pixel text-[10px] mt-0.5 leading-tight">Opening Battle</span>
        </div>
        <!-- Phase Countdown -->
        <div class="flex flex-col justify-center items-center px-4 py-2 border-r border-neon-yellow/25 min-w-[110px]">
          <span class="text-[9px] font-pixel tracking-widest text-gray-400 uppercase">NEXT PHASE</span>
          <span id="br-phase-timer" class="text-white font-pixel text-[13px] mt-0.5 tabular-nums">—</span>
        </div>
        <!-- Survivor Count -->
        <div class="flex flex-col justify-center items-center px-4 py-2 border-r border-neon-yellow/25 min-w-[100px]">
          <span class="text-[9px] font-pixel tracking-widest text-gray-400 uppercase">SURVIVING</span>
          <span id="br-remaining" class="text-neon-cyan font-pixel text-[13px] mt-0.5 tabular-nums">—</span>
        </div>
        <!-- Cull Threshold -->
        <div class="flex flex-col justify-center items-center px-4 py-2 border-r border-neon-yellow/25 flex-1">
          <span class="text-[9px] font-pixel tracking-widest text-gray-400 uppercase">CULL THRESHOLD</span>
          <span id="br-threshold" class="text-red-400 font-pixel text-[10px] mt-0.5 tabular-nums">—</span>
        </div>
        <!-- My K.O. Count -->
        <div class="flex flex-col justify-center items-center px-4 py-2 min-w-[80px]">
          <span class="text-[9px] font-pixel tracking-widest text-gray-400 uppercase">K.O.</span>
          <span id="br-kills" class="text-neon-green font-pixel text-[13px] mt-0.5 tabular-nums">0</span>
        </div>
      </div>
      <!-- Phase Progress Bar -->
      <div class="h-[3px] bg-gray-800 rounded-b-lg overflow-hidden">
        <div id="br-progress" class="h-full bg-gradient-to-r from-neon-yellow to-amber-500 transition-none" style="width:0%"></div>
      </div>`;'''

new_hud = '''hud.innerHTML = `
      <div class="flex items-stretch gap-0">
        <!-- Phase Name + Label -->
        <div class="flex flex-col justify-center px-4 py-2 border-r border-neon-yellow/25 min-w-[160px]">
          <span class="text-[9px] font-pixel tracking-widest text-gray-400 uppercase">PHASE</span>
          <span id="br-phase" class="text-neon-yellow font-pixel text-[10px] mt-0.5 leading-tight">Opening Battle</span>
        </div>
        <!-- Round Timer -->
        <div class="flex flex-col justify-center items-center px-4 py-2 border-r border-neon-yellow/25 min-w-[110px]">
          <span class="text-[9px] font-pixel tracking-widest text-gray-400 uppercase">ROUND TIMER</span>
          <span id="br-phase-timer" class="text-white font-pixel text-[13px] mt-0.5 tabular-nums">3:00</span>
        </div>
        <!-- Survivor Count -->
        <div class="flex flex-col justify-center items-center px-4 py-2 border-r border-neon-yellow/25 min-w-[100px]">
          <span class="text-[9px] font-pixel tracking-widest text-gray-400 uppercase">SURVIVING</span>
          <span id="br-remaining" class="text-neon-cyan font-pixel text-[13px] mt-0.5 tabular-nums">—</span>
        </div>
        <!-- Cull Threshold -->
        <div class="flex flex-col justify-center items-center px-4 py-2 border-r border-neon-yellow/25 flex-1">
          <span class="text-[9px] font-pixel tracking-widest text-gray-400 uppercase">ELIMINATED AT ROUND END</span>
          <span id="br-threshold" class="text-red-400 font-pixel text-[10px] mt-0.5 tabular-nums">—</span>
        </div>
        <!-- My K.O. Count -->
        <div class="flex flex-col justify-center items-center px-4 py-2 min-w-[80px]">
          <span class="text-[9px] font-pixel tracking-widest text-gray-400 uppercase">K.O.</span>
          <span id="br-kills" class="text-neon-green font-pixel text-[13px] mt-0.5 tabular-nums">0</span>
        </div>
      </div>
      <!-- Round Progress Bar -->
      <div class="h-[3px] bg-gray-800 rounded-b-lg overflow-hidden">
        <div id="br-progress" class="h-full bg-gradient-to-r from-neon-yellow to-amber-500 transition-none" style="width:0%"></div>
      </div>`;'''

content = content.replace(old_hud, new_hud)

# ==============================================================
# 2. Fix updateBattleRoyalHud - timer should count DOWN in round,
#    and threshold should show how many will be eliminated
# ==============================================================
old_timer = '''    if (threshEl) threshEl.textContent = battleRoyalCullThreshold > 0 ? `MIN ${battleRoyalCullThreshold.toLocaleString()} PTS` : 'NO CULL YET';
  
    // Phase countdown timer
    if (timerEl) {
      if (battleRoyalPhaseEndsAt && battleRoyalPhaseEndsAt > Date.now()) {
        const secLeft = Math.ceil((battleRoyalPhaseEndsAt - Date.now()) / 1000);
        const m = Math.floor(secLeft / 60);
        const s = secLeft % 60;
        timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
        timerEl.classList.toggle('text-red-400', secLeft <= 10);
        timerEl.classList.toggle('text-white', secLeft > 10);
      } else {
        timerEl.textContent = battleRoyalPhaseEndsAt === null ? '—' : 'FINAL';
      }
    }
  
    // Match progress bar (0→100% over 4 minutes)
    if (progressEl && battleRoyalStartedAt) {
      const elapsed = Date.now() - battleRoyalStartedAt;
      progressEl.style.width = `${Math.min(100, (elapsed / (4 * 60 * 1000)) * 100).toFixed(1)}%`;
    }'''

new_timer = '''    if (threshEl) threshEl.textContent = battleRoyalCullThreshold > 0 ? `${battleRoyalCullThreshold} BOTTOM PLAYERS` : 'NO CULL YET';

    // Round countdown timer (counts down from round duration)
    if (timerEl) {
      if (battleRoyalPhaseEndsAt && battleRoyalPhaseEndsAt > Date.now()) {
        const secLeft = Math.ceil((battleRoyalPhaseEndsAt - Date.now()) / 1000);
        const m = Math.floor(secLeft / 60);
        const s = secLeft % 60;
        timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
        timerEl.classList.toggle('text-red-400', secLeft <= 30);
        timerEl.classList.toggle('text-neon-yellow', secLeft > 30 && secLeft <= 60);
        timerEl.classList.toggle('text-white', secLeft > 60);
      } else {
        timerEl.textContent = battleRoyalPhaseEndsAt === null ? 'FINAL ROUND' : 'TIME!';
      }
    }

    // Round progress bar (counts up as round time passes)
    if (progressEl && battleRoyalStartedAt && battleRoyalPhaseEndsAt) {
      const roundDuration = battleRoyalPhaseEndsAt - battleRoyalStartedAt;
      const elapsed = Date.now() - battleRoyalStartedAt;
      progressEl.style.width = `${Math.min(100, (elapsed / roundDuration) * 100).toFixed(1)}%`;
    }'''

content = content.replace(old_timer, new_timer)

# ==============================================================
# 3. Fix onBattleRoyalPhase - pass cullThreshold as # to eliminate not score
#    and fix that battleRoyalPhaseEndsAt is set correctly relative to NOW
# ==============================================================
old_phase_handler = '''  network.onBattleRoyalPhase = (data) => {
    battleRoyalPhaseLabel = data.label;
    battleRoyalRemainingPlayers = data.remainingPlayers ?? battleRoyalRemainingPlayers;
    battleRoyalStartedAt = Date.now();
    battleRoyalPhaseEndsAt = data.nextAtMs ? (battleRoyalStartedAt + data.nextAtMs) : null;
    battleRoyalCullThreshold = data.cullThreshold ?? 0;
    
    if (data.scoreMultiplier) {
      gameManager.players.forEach(p => p.scoreManager.globalMultiplier = data.scoreMultiplier!);
    }
    
    updateBattleRoyalHud();
  };'''

new_phase_handler = '''  network.onBattleRoyalPhase = (data) => {
    battleRoyalPhaseLabel = data.label;
    battleRoyalRemainingPlayers = data.remainingPlayers ?? battleRoyalRemainingPlayers;
    battleRoyalStartedAt = Date.now();
    // nextAtMs is the duration of this round in ms; endsAt = now + duration
    battleRoyalPhaseEndsAt = data.nextAtMs ? (Date.now() + data.nextAtMs) : null;
    battleRoyalCullThreshold = data.cullThreshold ?? 0;

    if (data.scoreMultiplier) {
      gameManager.players.forEach(p => p.scoreManager.globalMultiplier = data.scoreMultiplier!);
    }

    // Show intermission overlay if this is an intermission phase
    if (data.phase === 'intermission') {
      showBrIntermissionOverlay(data.remainingPlayers ?? battleRoyalRemainingPlayers, data.nextAtMs ?? 5000);
    } else {
      hideBrIntermissionOverlay();
    }

    updateBattleRoyalHud();
  };'''

content = content.replace(old_phase_handler, new_phase_handler)

# ==============================================================
# 4. Add intermission overlay functions (insert after ensureCullBanner logic area)
# ==============================================================
intermission_code = '''
  // ============================================================
  // Intermission overlay (shown between rounds)
  // ============================================================
  let brIntermissionEl: HTMLElement | null = null;
  let brIntermissionTimer: number | null = null;

  function ensureIntermissionOverlay(): HTMLElement {
    if (brIntermissionEl) return brIntermissionEl;
    const el = document.createElement('div');
    el.id = 'br-intermission-overlay';
    el.className = 'hidden fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none';
    el.innerHTML = `
      <div class="bg-black/95 border-2 border-neon-yellow/80 rounded-2xl px-10 py-8 shadow-[0_0_64px_rgba(255,193,7,0.4)] max-w-[480px] w-full mx-4 text-center">
        <div class="text-neon-yellow font-pixel text-lg tracking-widest mb-1">ROUND COMPLETE</div>
        <div class="text-gray-400 font-pixel text-xs mb-4" id="br-inter-subline">Preparing next round...</div>
        <div class="text-white font-pixel text-3xl tabular-nums mb-2" id="br-inter-countdown">5</div>
        <div class="text-gray-500 font-pixel text-[9px] tracking-widest">NEXT ROUND BEGINS IN</div>
        <div class="mt-4 w-full bg-gray-800 rounded-full h-1 overflow-hidden">
          <div id="br-inter-bar" class="h-full bg-neon-yellow transition-none" style="width:100%"></div>
        </div>
      </div>`;
    document.body.appendChild(el);
    brIntermissionEl = el;
    return el;
  }

  function showBrIntermissionOverlay(remaining: number, durationMs: number) {
    const el = ensureIntermissionOverlay();
    el.classList.remove('hidden');
    const subline = el.querySelector('#br-inter-subline');
    if (subline) subline.textContent = `${remaining} players advance to the next round`;

    const countdownEl = el.querySelector('#br-inter-countdown') as HTMLElement | null;
    const barEl = el.querySelector('#br-inter-bar') as HTMLElement | null;
    const totalSec = Math.ceil(durationMs / 1000);
    let secLeft = totalSec;

    if (brIntermissionTimer !== null) clearInterval(brIntermissionTimer);
    if (countdownEl) countdownEl.textContent = String(secLeft);

    brIntermissionTimer = window.setInterval(() => {
      secLeft--;
      if (countdownEl) countdownEl.textContent = String(Math.max(0, secLeft));
      if (barEl) barEl.style.width = `${Math.max(0, (secLeft / totalSec) * 100).toFixed(1)}%`;
      if (secLeft <= 0) {
        if (brIntermissionTimer !== null) clearInterval(brIntermissionTimer);
        brIntermissionTimer = null;
      }
    }, 1000);
  }

  function hideBrIntermissionOverlay() {
    if (brIntermissionEl) brIntermissionEl.classList.add('hidden');
    if (brIntermissionTimer !== null) {
      clearInterval(brIntermissionTimer);
      brIntermissionTimer = null;
    }
  }

'''

# Insert before ensureCullBanner
content = content.replace(
    "  // ★★ Phase 2: Cull Elimination Banner",
    intermission_code + "  // ★★ Phase 2: Cull Elimination Banner"
)

# Fallback if exact string differs:
if 'showBrIntermissionOverlay' not in content:
    content = content.replace(
        "  function ensureCullBanner()",
        intermission_code + "  function ensureCullBanner()"
    )

with open("src/lobby.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("Done!")
