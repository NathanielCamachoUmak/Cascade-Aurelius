content = open('src/lobby.ts', 'r', encoding='utf-8').read()

old_timer = """  // Phase countdown timer
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

new_timer = """  // Phase countdown timer
  if (timerEl) {
    const endsAt = matchTimerEndsAt;
    if (endsAt && endsAt > Date.now()) {
      const secLeft = Math.ceil((endsAt - Date.now()) / 1000);
      const m = Math.floor(secLeft / 60);
      const s = secLeft % 60;
      timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
      timerEl.classList.toggle('text-red-400', secLeft <= 10);
      timerEl.classList.toggle('text-white', secLeft > 10);
    } else {
      timerEl.textContent = !endsAt ? '—' : 'FINAL';
    }
  }"""

content = content.replace(old_timer, new_timer)
open('src/lobby.ts', 'w', encoding='utf-8').write(content)
print("Updated BR HUD timer to use matchTimerEndsAt")
