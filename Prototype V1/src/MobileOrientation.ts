/**
 * MobileOrientation.ts
 * Strictly enforces landscape orientation on mobile devices across Cascade.
 * Displays a massive, full-screen retro cyberpunk rotating device prompt in portrait mode.
 */

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Debug override via URL: ?mobile=1 or ?forceMobile=1
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get('mobile') === '1' || searchParams.get('forceMobile') === '1') {
    return true;
  }
  
  // Debug override via document body class
  if (document.body && (document.body.classList.contains('force-mobile') || document.body.classList.contains('is-mobile-ua'))) {
    return true;
  }

  // Detect mobile UA
  const isMobileUA = /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  // iPadOS reports as Macintosh with multi-touch
  const isIPadOS = navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent);
  // Coarse pointer touch device with mobile dimensions
  const isTouchDevice = (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && window.matchMedia?.('(pointer: coarse)')?.matches;
  
  return Boolean(isMobileUA || isIPadOS || isTouchDevice);
}

export function isPortrait(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerHeight > window.innerWidth;
}

export function tryLockLandscape(): Promise<void> {
  if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.lock === 'function') {
    return screen.orientation.lock('landscape').catch(() => {
      // Browsers often reject orientation lock unless in fullscreen or not supported
    });
  }
  return Promise.resolve();
}

let enforcerInitialized = false;

export function initOrientationEnforcer(): void {
  if (typeof document === 'undefined' || enforcerInitialized) return;
  enforcerInitialized = true;

  const overlayId = 'cascade-orientation-enforcer';
  if (document.getElementById(overlayId)) return;

  // Global style block injected directly into document head
  const styleEl = document.createElement('style');
  styleEl.id = 'cascade-orientation-styles';
  styleEl.textContent = `
    /* Lock body scroll and isolate viewport while in portrait orientation on mobile */
    body.orientation-portrait-blocked {
      overflow: hidden !important;
      touch-action: none !important;
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      max-width: 100vw !important;
      height: 100vh !important;
      height: 100dvh !important;
    }

    /* Hide underlying wide game wrappers in portrait mode so the browser does NOT zoom-out the viewport */
    body.orientation-portrait-blocked > *:not(#cascade-orientation-enforcer):not(script):not(style) {
      display: none !important;
    }

    #cascade-orientation-enforcer {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      height: 100dvh;
      z-index: 9999999;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: env(safe-area-inset-top, 20px) 16px env(safe-area-inset-bottom, 20px) 16px;
      background: radial-gradient(circle at 50% 35%, #23164D 0%, #0D0B1A 65%, #030206 100%);
      color: #FFFFFF;
      text-align: center;
      user-select: none;
      -webkit-user-select: none;
      box-sizing: border-box;
      overflow-y: auto;
    }

    /* Scanline overlay */
    #cascade-orientation-enforcer::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      opacity: 0.18;
      background-image: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0, 0, 0, 0.4) 2px,
        rgba(0, 0, 0, 0.4) 4px
      );
    }

    /* Ambient glowing neon backdrop */
    .coe-glow-sphere {
      position: absolute;
      width: 650px;
      height: 650px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(0, 255, 255, 0.25) 0%, rgba(255, 20, 147, 0.16) 50%, transparent 70%);
      filter: blur(70px);
      pointer-events: none;
      animation: coe-pulse 4s ease-in-out infinite alternate;
    }

    @keyframes coe-pulse {
      0% { transform: scale(0.9); opacity: 0.7; }
      100% { transform: scale(1.25); opacity: 1; }
    }

    /* Main full-screen flex container */
    .coe-content {
      position: relative;
      z-index: 2;
      width: 100%;
      max-width: 480px;
      min-height: 100%;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-evenly;
      padding: 16px 8px;
      box-sizing: border-box;
    }

    /* HUGE phone rotation animation (fills ~70% screen width when horizontal) */
    .coe-phone-wrapper {
      position: relative;
      width: 310px;
      height: 310px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 8px 0;
    }

    .coe-phone-icon {
      width: 160px;
      height: 260px;
      border: 6px solid #00FFFF;
      border-radius: 30px;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: 14px 0;
      box-shadow: 0 0 60px rgba(0, 255, 255, 0.7), inset 0 0 30px rgba(0, 255, 255, 0.35);
      animation: coe-rotate-phone 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      transform-origin: center center;
      background: rgba(13, 11, 26, 0.96);
      box-sizing: border-box;
    }

    .coe-phone-screen {
      width: 126px;
      height: 180px;
      border: 2.5px dashed rgba(0, 255, 255, 0.7);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 255, 255, 0.12);
    }

    .coe-phone-screen-tetromino {
      width: 58px;
      height: 58px;
      border: 5px solid #FFD700;
      box-shadow: 0 0 25px #FFD700;
      background: rgba(255, 215, 0, 0.5);
    }

    .coe-phone-notch {
      width: 44px;
      height: 6px;
      background: #00FFFF;
      border-radius: 3px;
    }

    .coe-phone-bar {
      width: 56px;
      height: 5px;
      background: rgba(0, 255, 255, 0.85);
      border-radius: 3px;
    }

    @keyframes coe-rotate-phone {
      0%, 15% {
        transform: rotate(0deg);
      }
      50%, 75% {
        transform: rotate(90deg);
      }
      90%, 100% {
        transform: rotate(0deg);
      }
    }

    .coe-badge {
      font-family: 'Press Start 2P', monospace;
      font-size: clamp(12px, 3.5vw, 14px);
      letter-spacing: 0.2em;
      color: #FF1493;
      border: 2.5px solid rgba(255, 20, 147, 0.7);
      background: rgba(255, 20, 147, 0.18);
      padding: 12px 26px;
      border-radius: 9999px;
      text-transform: uppercase;
      box-shadow: 0 0 25px rgba(255, 20, 147, 0.45);
    }

    .coe-title {
      font-family: 'Press Start 2P', monospace;
      font-size: clamp(24px, 7.5vw, 34px);
      line-height: 1.45;
      color: #00FFFF;
      text-shadow: 0 0 30px rgba(0, 255, 255, 0.85), 0 0 60px rgba(0, 255, 255, 0.5);
      text-transform: uppercase;
      margin: 12px 0 8px 0;
      width: 95%;
    }

    .coe-desc {
      font-family: 'Inter', sans-serif;
      font-size: clamp(17px, 4.8vw, 20px);
      line-height: 1.6;
      color: #E2E8F0;
      max-width: 420px;
      width: 92%;
      margin: 6px 0 16px 0;
      padding: 0 8px;
    }

    .coe-actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      margin-top: 8px;
    }

    .coe-btn-fullscreen {
      font-family: 'Press Start 2P', monospace;
      font-size: clamp(14px, 4.2vw, 16px);
      height: 64px;
      padding: 0 28px;
      background: linear-gradient(135deg, #00FFFF 0%, #00B8D4 100%);
      color: #0D0B1A;
      font-weight: bold;
      border: none;
      border-radius: 16px;
      cursor: pointer;
      box-shadow: 0 0 40px rgba(0, 255, 255, 0.7);
      transition: transform 0.15s, box-shadow 0.15s;
      text-transform: uppercase;
      width: 92%;
      max-width: 400px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .coe-btn-fullscreen:active {
      transform: scale(0.96);
      box-shadow: 0 0 25px rgba(0, 255, 255, 0.95);
    }
  `;
  document.head.appendChild(styleEl);

  const overlay = document.createElement('div');
  overlay.id = overlayId;
  overlay.setAttribute('aria-live', 'assertive');
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');

  overlay.innerHTML = `
    <div class="coe-glow-sphere"></div>
    <div class="coe-content">
      <div class="coe-badge">LANDSCAPE REQUIRED</div>

      <div class="coe-phone-wrapper">
        <div class="coe-phone-icon">
          <div class="coe-phone-notch"></div>
          <div class="coe-phone-screen">
            <div class="coe-phone-screen-tetromino"></div>
          </div>
          <div class="coe-phone-bar"></div>
        </div>
      </div>

      <h2 class="coe-title">ROTATE DEVICE TO LANDSCAPE</h2>
      <p class="coe-desc">
        Cascade is strictly configured for <strong>landscape mode</strong>. Please turn your phone sideways to unlock the game boards, tactical radar, and controls.
      </p>

      <div class="coe-actions">
        <button id="coe-fullscreen-btn" class="coe-btn-fullscreen">
          ROTATE &amp; PLAY ⤢
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Fullscreen & Lock request button
  const fsBtn = document.getElementById('coe-fullscreen-btn');
  if (fsBtn) {
    fsBtn.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        // Fullscreen request might be suppressed or unsupported
      }
      tryLockLandscape();
    });
  }

  function updateOrientationState() {
    const mobile = isMobileDevice();
    const portrait = isPortrait();

    if (mobile) {
      document.body.classList.add('is-mobile-device');
    } else {
      document.body.classList.remove('is-mobile-device');
    }

    if (mobile && portrait) {
      overlay.style.display = 'flex';
      document.body.classList.add('orientation-portrait-blocked');
      document.body.style.overflow = 'hidden';
    } else {
      overlay.style.display = 'none';
      document.body.classList.remove('orientation-portrait-blocked');
      document.body.style.overflow = '';
      if (mobile && !portrait) {
        tryLockLandscape();
      }
    }
  }

  window.addEventListener('resize', updateOrientationState, { passive: true });
  window.addEventListener('orientationchange', () => {
    setTimeout(updateOrientationState, 150);
  }, { passive: true });

  if (screen.orientation && typeof screen.orientation.addEventListener === 'function') {
    screen.orientation.addEventListener('change', updateOrientationState);
  }

  // Initial check
  updateOrientationState();
}

// Auto-run when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initOrientationEnforcer());
  } else {
    initOrientationEnforcer();
  }
}
