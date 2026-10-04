with open('src/lobby.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Check if functions already exist
if 'function showBrIntermissionOverlay' in content:
    print("Already exists!")
else:
    # Insert before function ensureCullBanner
    insert_before = 'function ensureCullBanner(): HTMLElement {'
    insert_code = '''
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
      <div style="background:rgba(0,0,0,0.97);border:2px solid rgba(255,193,7,0.8);border-radius:16px;padding:40px 48px;text-align:center;max-width:480px;width:calc(100vw - 32px);">
        <div style="color:#FFD700;font-family:monospace;font-size:18px;letter-spacing:3px;margin-bottom:8px;">ROUND COMPLETE</div>
        <div style="color:#9CA3AF;font-family:monospace;font-size:11px;margin-bottom:16px;" id="br-inter-subline">Preparing next round...</div>
        <div style="color:white;font-family:monospace;font-size:48px;margin-bottom:4px;" id="br-inter-countdown">5</div>
        <div style="color:#6B7280;font-family:monospace;font-size:9px;letter-spacing:2px;">NEXT ROUND BEGINS IN</div>
        <div style="margin-top:16px;width:100%;background:#1F2937;border-radius:999px;height:4px;overflow:hidden;">
          <div id="br-inter-bar" style="height:100%;background:#FFD700;width:100%;transition:none;"></div>
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
    if (subline) subline.textContent = remaining + ' players advance to the next round';

    const countdownEl = el.querySelector('#br-inter-countdown') as HTMLElement | null;
    const barEl = el.querySelector('#br-inter-bar') as HTMLElement | null;
    const totalSec = Math.ceil(durationMs / 1000);
    let secLeft = totalSec;

    if (brIntermissionTimer !== null) clearInterval(brIntermissionTimer);
    if (countdownEl) countdownEl.textContent = String(secLeft);

    brIntermissionTimer = window.setInterval(() => {
      secLeft--;
      if (countdownEl) countdownEl.textContent = String(Math.max(0, secLeft));
      if (barEl) barEl.style.width = Math.max(0, (secLeft / totalSec) * 100).toFixed(1) + '%';
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
    if insert_before in content:
        content = content.replace(insert_before, insert_code + insert_before)
        print("Inserted intermission overlay functions before ensureCullBanner")
    else:
        print("ERROR: Could not find anchor 'function ensureCullBanner(): HTMLElement {'")

with open('src/lobby.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
