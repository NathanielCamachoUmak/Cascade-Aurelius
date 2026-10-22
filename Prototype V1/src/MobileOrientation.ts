/**
 * MobileOrientation.ts
 * Strictly enforces landscape orientation on mobile devices across Cascade.
 * Displays a monumental, full-screen retro cyberpunk rotating device prompt in portrait mode.
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
      max-width: 100vw;
      height: 100vh;
      height: 100dvh;
      z-index: 9999999;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: env(safe-area-inset-top, 24px) 12px env(safe-area-inset-bottom, 24px) 12px;
      background: radial-gradient(circle at 50% 35%, #2A175C 0%, #0D0B1A 65%, #020104 100%);
      color: #FFFFFF;
      text-align: center;
      user-select: none;
      -webkit-user-select: none;
      box-sizing: border-box;
      overflow-x: hidden !important;
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
      width: 900px;
      height: 900px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(0, 255, 255, 0.32) 0%, rgba(255, 20, 147, 0.22) 50%, transparent 70%);
      filter: blur(100px);
      pointer-events: none;
      animation: coe-pulse 4s ease-in-out infinite alternate;
    }

    @keyframes coe-pulse {
      0% { transform: scale(0.9); opacity: 0.75; }
      100% { transform: scale(1.3); opacity: 1; }
    }

    /* Monumental full-screen flex container filling the phone screen */
    .coe-content {
      position: relative;
      z-index: 2;
      width: 100%;
      max-width: 600px;
      min-height: 100%;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-evenly;
      padding: 18px 6px;
      box-sizing: border-box;
      overflow-x: hidden;
    }

    /* MONUMENTAL phone rotation animation (spans ~88% screen width when rotated horizontally) */
    .coe-phone-wrapper {
      position: relative;
      width: clamp(330px, 88vw, 440px);
      height: clamp(330px, 88vw, 440px);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 12px 0;
    }

    .coe-phone-icon {
      width: clamp(220px, 56vw, 290px);
      height: clamp(340px, 86vw, 430px);
      border: 12px solid #00FFFF;
      border-radius: 46px;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      padding: 22px 0;
      box-shadow: 0 0 95px rgba(0, 255, 255, 0.95), inset 0 0 45px rgba(0, 255, 255, 0.5);
      animation: coe-rotate-phone 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      transform-origin: center center;
      background: rgba(13, 11, 26, 0.96);
      box-sizing: border-box;
    }

    .coe-phone-screen {
      width: 82%;
      height: 74%;
      border: 4px dashed rgba(0, 255, 255, 0.9);
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 255, 255, 0.16);
    }

    .coe-phone-screen-tetromino {
      width: 110px;
      height: 110px;
      border: 10px solid #FFD700;
      box-shadow: 0 0 45px #FFD700, inset 0 0 20px rgba(255, 215, 0, 0.6);
      background: rgba(255, 215, 0, 0.65);
    }

    .coe-phone-notch {
      width: 80px;
      height: 12px;
      background: #00FFFF;
      border-radius: 6px;
    }

    .coe-phone-bar {
      width: 100px;
      height: 10px;
      background: rgba(0, 255, 255, 0.95);
      border-radius: 5px;
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

    /* MONUMENTAL FONT SIZES & BADGES */
    .coe-badge {
      display: inline-flex;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 12px;
      font-family: 'Press Start 2P', monospace;
      font-size: clamp(20px, 5.8vw, 28px);
      letter-spacing: 0.2em;
      color: #FF1493;
      border: 4.5px solid rgba(255, 20, 147, 0.9);
      background: rgba(255, 20, 147, 0.24);
      padding: 16px 36px;
      border-radius: 9999px;
      text-transform: uppercase;
      box-shadow: 0 0 40px rgba(255, 20, 147, 0.6);
      margin-bottom: 8px;
      box-sizing: border-box;
      max-width: 95vw;
    }

    .coe-title {
      font-family: 'Press Start 2P', monospace;
      font-size: clamp(32px, 8.8vw, 44px);
      line-height: 1.35;
      color: #00FFFF;
      text-shadow: 0 0 40px rgba(0, 255, 255, 0.95), 0 0 80px rgba(0, 255, 255, 0.7);
      text-transform: uppercase;
      margin: 14px 0 10px 0;
      width: 100%;
      letter-spacing: 0.02em;
      word-break: normal;
    }

    .coe-title-highlight {
      color: #FFD700;
      text-shadow: 0 0 40px rgba(255, 215, 0, 0.95), 0 0 80px rgba(255, 215, 0, 0.7);
    }

    .coe-desc {
      font-family: 'Inter', sans-serif;
      font-size: clamp(22px, 6.2vw, 30px);
      font-weight: 700;
      line-height: 1.5;
      color: #FFFFFF;
      text-shadow: 0 0 16px rgba(255, 255, 255, 0.4);
      max-width: 560px;
      width: 95%;
      margin: 8px 0 20px 0;
      padding: 0 8px;
    }

    .coe-desc strong {
      color: #00FFFF;
      text-shadow: 0 0 20px rgba(0, 255, 255, 0.8);
      font-weight: 900;
    }

    .coe-actions {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      margin-top: 10px;
    }

    .coe-btn-fullscreen {
      font-family: 'Press Start 2P', monospace;
      font-size: clamp(18px, 5.2vw, 26px);
      min-height: 94px;
      padding: 18px 36px;
      background: linear-gradient(135deg, #00FFFF 0%, #00B8D4 100%);
      color: #0D0B1A;
      font-weight: bold;
      border: 4px solid #FFFFFF;
      border-radius: 26px;
      cursor: pointer;
      box-shadow: 0 0 55px rgba(0, 255, 255, 0.95), 0 8px 20px rgba(0, 0, 0, 0.6);
      transition: transform 0.15s, box-shadow 0.15s;
      text-transform: uppercase;
      width: 95%;
      max-width: 520px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      letter-spacing: 0.05em;
    }

    .coe-btn-fullscreen:active {
      transform: scale(0.96);
      box-shadow: 0 0 35px rgba(0, 255, 255, 1);
    }

    .coe-btn-icon {
      font-size: 1.25em;
      line-height: 1;
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
      <div class="coe-badge">
        <span>LANDSCAPE</span>
        <span>REQUIRED</span>
      </div>

      <div class="coe-phone-wrapper">
        <div class="coe-phone-icon">
          <div class="coe-phone-notch"></div>
          <div class="coe-phone-screen">
            <div class="coe-phone-screen-tetromino"></div>
          </div>
          <div class="coe-phone-bar"></div>
        </div>
      </div>

      <h2 class="coe-title">
        ROTATE<br>
        DEVICE TO<br>
        <span class="coe-title-highlight">LANDSCAPE</span>
      </h2>

      <p class="coe-desc">
        Cascade is built for <strong>landscape mode</strong>.<br>
        Turn your phone sideways to play!
      </p>

      <div class="coe-actions">
        <button id="coe-fullscreen-btn" class="coe-btn-fullscreen">
          <span>ROTATE &amp; PLAY</span>
          <span class="coe-btn-icon">⤢</span>
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
