/**
 * MobileOrientation.ts
 * Strictly enforces landscape orientation on mobile devices across Cascade.
 * Displays a massive, full-screen retro cyberpunk rotating device prompt in portrait mode (+60% enlarged).
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
      padding: env(safe-area-inset-top, 24px) 14px env(safe-area-inset-bottom, 24px) 14px;
      background: radial-gradient(circle at 50% 35%, #261655 0%, #0D0B1A 65%, #020205 100%);
      color: #FFFFFF;
      text-align: center;
      user-select: none;
      -webkit-user-select: none;
      box-sizing: border-box;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
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
      width: 850px;
      height: 850px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(0, 255, 255, 0.3) 0%, rgba(255, 20, 147, 0.2) 50%, transparent 70%);
      filter: blur(90px);
      pointer-events: none;
      animation: coe-pulse 4s ease-in-out infinite alternate;
    }

    @keyframes coe-pulse {
      0% { transform: scale(0.9); opacity: 0.7; }
      100% { transform: scale(1.3); opacity: 1; }
    }

    /* Main full-screen flex container (+60% max-width) */
    .coe-content {
      position: relative;
      z-index: 2;
      width: 100%;
      max-width: 680px;
      min-height: 100%;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-evenly;
      padding: 20px 8px;
      box-sizing: border-box;
    }

    /* GIGANTIC phone rotation animation (+60% larger, nearly full width when horizontal) */
    .coe-phone-wrapper {
      position: relative;
      width: clamp(340px, 92vw, 480px);
      height: clamp(340px, 92vw, 480px);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 14px 0;
    }

    .coe-phone-icon {
      width: clamp(220px, 58vw, 300px);
      height: clamp(350px, 90vw, 460px);
      border: 12px solid #00FFFF;
      border-radius: 44px;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: 20px 0;
      box-shadow: 0 0 100px rgba(0, 255, 255, 0.85), inset 0 0 45px rgba(0, 255, 255, 0.45);
      animation: coe-rotate-phone 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      transform-origin: center center;
      background: rgba(13, 11, 26, 0.96);
      box-sizing: border-box;
    }

    .coe-phone-screen {
      width: 82%;
      height: 74%;
      border: 4px dashed rgba(0, 255, 255, 0.8);
      border-radius: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 255, 255, 0.16);
    }

    .coe-phone-screen-tetromino {
      width: 105px;
      height: 105px;
      border: 9px solid #FFD700;
      box-shadow: 0 0 40px #FFD700;
      background: rgba(255, 215, 0, 0.6);
    }

    .coe-phone-notch {
      width: 76px;
      height: 10px;
      background: #00FFFF;
      border-radius: 5px;
    }

    .coe-phone-bar {
      width: 96px;
      height: 8px;
      background: rgba(0, 255, 255, 0.9);
      border-radius: 4px;
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

    /* +60% BIGGER FONT SIZES & BADGES */
    .coe-badge {
      font-family: 'Press Start 2P', monospace;
      font-size: clamp(22px, 6vw, 30px);
      letter-spacing: 0.22em;
      color: #FF1493;
      border: 5px solid rgba(255, 20, 147, 0.85);
      background: rgba(255, 20, 147, 0.22);
      padding: 18px 42px;
      border-radius: 9999px;
      text-transform: uppercase;
      box-shadow: 0 0 40px rgba(255, 20, 147, 0.6);
      margin-bottom: 12px;
    }

    .coe-title {
      font-family: 'Press Start 2P', monospace;
      font-size: clamp(36px, 10.5vw, 56px);
      line-height: 1.35;
      color: #00FFFF;
      text-shadow: 0 0 45px rgba(0, 255, 255, 0.95), 0 0 90px rgba(0, 255, 255, 0.7);
      text-transform: uppercase;
      margin: 20px 0 16px 0;
      width: 98%;
    }

    .coe-desc {
      font-family: 'Inter', sans-serif;
      font-size: clamp(28px, 8vw, 42px);
      font-weight: 700;
      line-height: 1.5;
      color: #F1F5F9;
      max-width: 580px;
      width: 95%;
      margin: 12px 0 24px 0;
      padding: 0 6px;
    }

    .coe-actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      margin-top: 14px;
    }

    .coe-btn-fullscreen {
      font-family: 'Press Start 2P', monospace;
      font-size: clamp(22px, 6.5vw, 32px);
      height: 96px;
      padding: 0 44px;
      background: linear-gradient(135deg, #00FFFF 0%, #00B8D4 100%);
      color: #0D0B1A;
      font-weight: bold;
      border: none;
      border-radius: 26px;
      cursor: pointer;
      box-shadow: 0 0 65px rgba(0, 255, 255, 0.9);
      transition: transform 0.15s, box-shadow 0.15s;
      text-transform: uppercase;
      width: 95%;
      max-width: 520px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .coe-btn-fullscreen:active {
      transform: scale(0.96);
      box-shadow: 0 0 40px rgba(0, 255, 255, 1);
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
        Cascade is built for <strong>landscape mode</strong>.<br>Turn your phone sideways to play!
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
