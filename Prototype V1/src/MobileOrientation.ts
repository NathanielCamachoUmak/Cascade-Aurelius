/**
 * MobileOrientation.ts
 * Strictly enforces landscape orientation on mobile devices across Cascade.
 * Displays a retro cyberpunk rotating device prompt when in portrait mode.
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

  const overlay = document.createElement('div');
  overlay.id = overlayId;
  overlay.setAttribute('aria-live', 'assertive');
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');

  overlay.innerHTML = `
    <style>
      #cascade-orientation-enforcer {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: radial-gradient(circle at center, #17112E 0%, #0D0B1A 70%, #06050C 100%);
        color: #FFFFFF;
        text-align: center;
        user-select: none;
        box-sizing: border-box;
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
        width: 320px;
        height: 320px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(0, 255, 255, 0.15) 0%, rgba(255, 20, 147, 0.08) 50%, transparent 70%);
        filter: blur(40px);
        pointer-events: none;
        animation: coe-pulse 4s ease-in-out infinite alternate;
      }

      @keyframes coe-pulse {
        0% { transform: scale(0.9); opacity: 0.7; }
        100% { transform: scale(1.15); opacity: 1; }
      }

      .coe-content {
        position: relative;
        z-index: 2;
        max-width: 420px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      /* Phone rotation animation */
      .coe-phone-wrapper {
        position: relative;
        width: 100px;
        height: 100px;
        margin-bottom: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .coe-phone-icon {
        width: 54px;
        height: 88px;
        border: 3px solid #00FFFF;
        border-radius: 12px;
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        box-shadow: 0 0 20px rgba(0, 255, 255, 0.4), inset 0 0 10px rgba(0, 255, 255, 0.2);
        animation: coe-rotate-phone 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        transform-origin: center center;
        background: rgba(13, 11, 26, 0.85);
      }

      .coe-phone-screen {
        width: 38px;
        height: 56px;
        border: 1px dashed rgba(0, 255, 255, 0.6);
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 255, 255, 0.05);
      }

      .coe-phone-screen-tetromino {
        width: 18px;
        height: 18px;
        border: 2px solid #FFD700;
        box-shadow: 0 0 8px #FFD700;
        background: rgba(255, 215, 0, 0.3);
      }

      .coe-phone-notch {
        width: 16px;
        height: 3px;
        background: #00FFFF;
        border-radius: 2px;
      }

      .coe-phone-bar {
        width: 20px;
        height: 2px;
        background: rgba(0, 255, 255, 0.6);
        border-radius: 1px;
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
        font-size: 9px;
        letter-spacing: 0.15em;
        color: #FF1493;
        border: 1px solid rgba(255, 20, 147, 0.4);
        background: rgba(255, 20, 147, 0.1);
        padding: 5px 12px;
        border-radius: 9999px;
        margin-bottom: 16px;
        text-transform: uppercase;
        box-shadow: 0 0 10px rgba(255, 20, 147, 0.2);
      }

      .coe-title {
        font-family: 'Press Start 2P', monospace;
        font-size: 15px;
        line-height: 1.5;
        color: #00FFFF;
        margin-bottom: 12px;
        text-shadow: 0 0 12px rgba(0, 255, 255, 0.6);
        text-transform: uppercase;
      }

      .coe-desc {
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        line-height: 1.6;
        color: #CBD5E1;
        margin-bottom: 24px;
        max-width: 340px;
      }

      .coe-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
        max-width: 280px;
      }

      .coe-btn-fullscreen {
        font-family: 'Press Start 2P', monospace;
        font-size: 10px;
        padding: 14px 18px;
        background: linear-gradient(135deg, #00FFFF 0%, #00B8D4 100%);
        color: #0D0B1A;
        font-weight: bold;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 0 20px rgba(0, 255, 255, 0.4);
        transition: transform 0.15s, box-shadow 0.15s;
        text-transform: uppercase;
      }

      .coe-btn-fullscreen:active {
        transform: scale(0.96);
        box-shadow: 0 0 10px rgba(0, 255, 255, 0.6);
      }
    </style>

    <div class="coe-glow-sphere"></div>
    <div class="coe-content">
      <div class="coe-phone-wrapper">
        <div class="coe-phone-icon">
          <div class="coe-phone-notch"></div>
          <div class="coe-phone-screen">
            <div class="coe-phone-screen-tetromino"></div>
          </div>
          <div class="coe-phone-bar"></div>
        </div>
      </div>

      <div class="coe-badge">MOBILE SENSOR DETECTED</div>
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
