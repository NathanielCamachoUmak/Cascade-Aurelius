content = open('src/lobby.ts', 'r', encoding='utf-8').read()

old_hud = """  if (phaseEl) phaseEl.textContent = battleRoyalPhaseLabel || 'Opening Battle';
  if (remainEl) remainEl.textContent = String(battleRoyalRemainingPlayers);
  if (threshEl) threshEl.textContent = battleRoyalCullThreshold > 0 ? `${battleRoyalCullThreshold} BOTTOM PLAYERS` : 'NO CULL YET';

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
  }"""

new_hud = """  // BULLETPROOF FALLBACK: If the game has been running for 5+ seconds but we STILL don't have a timer, manually infer it.
  if (battleRoyalPhaseEndsAt === null && battleRoyalStartedAt && Date.now() - battleRoyalStartedAt > 5000) {
    battleRoyalPhaseEndsAt = battleRoyalStartedAt + 90000;
    battleRoyalPhaseLabel = 'Round 1 - Top 20 Qualify';
    battleRoyalCullThreshold = 10;
  }

  if (phaseEl) phaseEl.textContent = battleRoyalPhaseLabel || 'Opening Battle';
  if (remainEl) remainEl.textContent = String(battleRoyalRemainingPlayers);
  if (threshEl) threshEl.textContent = battleRoyalCullThreshold > 0 ? `${battleRoyalCullThreshold} BOTTOM PLAYERS` : 'NO CULL YET';

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
  }"""

content = content.replace(old_hud, new_hud)

open('src/lobby.ts', 'w', encoding='utf-8').write(content)
