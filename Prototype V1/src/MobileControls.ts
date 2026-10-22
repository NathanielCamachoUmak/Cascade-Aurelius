/**
 * MobileControls.ts
 * On-screen touch controls for Cascade on mobile devices in landscape mode.
 * Features Q, E, Ultimate (R), Hold (C), Target (Tab), Rotations, and Movement.
 */

import { isMobileDevice } from './MobileOrientation';

export function initMobileControls() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('mobile-controls')) return;

  const container = document.createElement('div');
  container.id = 'mobile-controls';
  container.className = 'fixed inset-0 z-[999] pointer-events-none select-none';
  
  if (isMobileDevice()) {
    document.body.classList.add('is-mobile-ua');
    document.body.classList.add('is-mobile-device');
  }
  
  container.innerHTML = `
    <style>
      #mobile-controls {
        display: none;
        justify-content: space-between;
        align-items: flex-end;
        padding: 8px 12px 14px 12px;
        box-sizing: border-box;
      }
      
      /* Display when a game is active and on mobile or when forced */
      body.game-active.is-mobile-device #mobile-controls,
      body.game-active.is-mobile-ua #mobile-controls,
      body.game-active.force-mobile #mobile-controls {
        display: flex;
      }

      /* Also display on touch devices if game is active and in landscape */
      @media (hover: none) and (pointer: coarse) and (orientation: landscape) {
        body.game-active #mobile-controls {
          display: flex;
        }
      }
      
      .mc-pad {
        position: relative;
        width: 170px;
        height: 190px;
        pointer-events: auto;
        touch-action: none;
      }
      
      .mc-btn {
        position: absolute;
        width: 48px;
        height: 48px;
        background: rgba(13, 11, 26, 0.78);
        border: 2px solid rgba(0, 255, 255, 0.5);
        border-radius: 50%;
        color: #00FFFF;
        font-family: 'Press Start 2P', monospace;
        font-size: 13px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
        box-shadow: 0 0 10px rgba(0, 255, 255, 0.25);
        transition: transform 0.08s ease, background 0.08s ease, border-color 0.08s ease;
      }

      .mc-btn-label {
        font-size: 6px;
        font-family: 'Inter', sans-serif;
        font-weight: 700;
        letter-spacing: 0.05em;
        opacity: 0.75;
        margin-top: 1px;
      }
      
      .mc-btn:active, .mc-btn.active {
        background: rgba(0, 255, 255, 0.35);
        border-color: #00FFFF;
        color: #FFFFFF;
        transform: scale(0.92);
        box-shadow: 0 0 16px rgba(0, 255, 255, 0.8);
      }

      /* Special colors for specific action types */
      .mc-btn-magenta {
        border-color: rgba(255, 20, 147, 0.6);
        color: #FF1493;
        box-shadow: 0 0 10px rgba(255, 20, 147, 0.25);
      }
      .mc-btn-magenta:active, .mc-btn-magenta.active {
        background: rgba(255, 20, 147, 0.35);
        border-color: #FF1493;
        color: #FFFFFF;
        box-shadow: 0 0 16px rgba(255, 20, 147, 0.8);
      }

      .mc-btn-yellow {
        border-color: rgba(255, 215, 0, 0.6);
        color: #FFD700;
        box-shadow: 0 0 10px rgba(255, 215, 0, 0.25);
      }
      .mc-btn-yellow:active, .mc-btn-yellow.active {
        background: rgba(255, 215, 0, 0.35);
        border-color: #FFD700;
        color: #FFFFFF;
        box-shadow: 0 0 16px rgba(255, 215, 0, 0.8);
      }

      /* Left Control Pad (Abilities, Hold & Horizontal Movement) */
      #mc-q { top: 0px; left: 8px; }
      #mc-e { top: 0px; left: 66px; }
      #mc-hold { top: 0px; left: 124px; }
      #mc-left { bottom: 20px; left: 12px; font-size: 20px; }
      #mc-right { bottom: 20px; left: 84px; font-size: 20px; }
      
      /* Right Control Pad (Hard/Soft drop, Rotations, Ultimate, Target) */
      #mc-target { top: 0px; left: 4px; font-size: 11px; }
      #mc-r { top: 0px; left: 62px; }
      #mc-hdrop { top: 0px; left: 120px; font-size: 20px; }
      #mc-ccw { top: 64px; left: 8px; font-size: 18px; }
      #mc-cw { top: 64px; left: 104px; font-size: 18px; }
      #mc-sdrop { bottom: 12px; left: 56px; font-size: 20px; }
    </style>
    
    <!-- Left Hand: Abilities Q, E, Hold & Left/Right -->
    <div class="mc-pad left-pad">
      <div class="mc-btn mc-btn-cyan" id="mc-q" data-key="q">
        <span>Q</span>
        <span class="mc-btn-label">SKILL</span>
      </div>
      <div class="mc-btn mc-btn-yellow" id="mc-e" data-key="e">
        <span>E</span>
        <span class="mc-btn-label">SKILL</span>
      </div>
      <div class="mc-btn mc-btn-cyan" id="mc-hold" data-key="c">
        <span>C</span>
        <span class="mc-btn-label">HOLD</span>
      </div>
      <div class="mc-btn" id="mc-left" data-key="ArrowLeft">‹</div>
      <div class="mc-btn" id="mc-right" data-key="ArrowRight">›</div>
    </div>
    
    <!-- Right Hand: Target, Ult R, Hard Drop, Rotations CCW/CW, Soft Drop -->
    <div class="mc-pad right-pad">
      <div class="mc-btn mc-btn-magenta" id="mc-target" data-key="Tab">
        <span>TAB</span>
        <span class="mc-btn-label">TARGET</span>
      </div>
      <div class="mc-btn mc-btn-magenta" id="mc-r" data-key="r">
        <span>R</span>
        <span class="mc-btn-label">ULT</span>
      </div>
      <div class="mc-btn mc-btn-yellow" id="mc-hdrop" data-key=" ">
        <span>⤓</span>
        <span class="mc-btn-label">DROP</span>
      </div>
      <div class="mc-btn" id="mc-ccw" data-key="z">↺</div>
      <div class="mc-btn" id="mc-cw" data-key="x">↻</div>
      <div class="mc-btn" id="mc-sdrop" data-key="ArrowDown">↓</div>
    </div>
  `;
  document.body.appendChild(container);

  const btns = container.querySelectorAll<HTMLElement>('.mc-btn');
  btns.forEach(btn => {
    const key = btn.getAttribute('data-key');
    if (!key) return;
    
    let isPressed = false;

    const triggerKeyDown = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (isPressed) return;
      isPressed = true;
      btn.classList.add('active');
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key,
        code: key === ' ' ? 'Space' : key === 'Tab' ? 'Tab' : undefined,
        bubbles: true,
        cancelable: true
      }));
    };

    const triggerKeyUp = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isPressed) return;
      isPressed = false;
      btn.classList.remove('active');
      window.dispatchEvent(new KeyboardEvent('keyup', {
        key,
        code: key === ' ' ? 'Space' : key === 'Tab' ? 'Tab' : undefined,
        bubbles: true,
        cancelable: true
      }));
    };
    
    btn.addEventListener('touchstart', triggerKeyDown, { passive: false });
    btn.addEventListener('touchend', triggerKeyUp, { passive: false });
    btn.addEventListener('touchcancel', triggerKeyUp, { passive: false });
    
    // For mouse testing
    btn.addEventListener('mousedown', triggerKeyDown);
    btn.addEventListener('mouseup', triggerKeyUp);
    btn.addEventListener('mouseleave', triggerKeyUp);
  });
}
