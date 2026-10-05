export function initMobileControls() {
  const container = document.createElement('div');
  container.id = 'mobile-controls';
  container.className = 'fixed inset-0 z-[999] pointer-events-none';
  
  // Check if the user agent is actually a mobile device.
  // When a mobile user requests "Desktop Site", the browser spoofs a desktop UA (e.g., Mac OS X or Windows)
  // and removes "Mobi", "iPhone", "Android", etc.
  const isMobileUA = /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobileUA) {
    document.body.classList.add('is-mobile-ua');
  }
  
  // HTML structure based on user draft
  container.innerHTML = `
    <style>
      #mobile-controls { display: none; justify-content: space-between; }
      
      /* Only show when body has the class, on touch devices, AND when it's a mobile UA */
      @media (hover: none) and (pointer: coarse) {
        body.game-active.is-mobile-ua #mobile-controls { display: flex; }
      }
      /* Optional: allow forcing it for testing by adding a debug class */
      body.game-active.force-mobile #mobile-controls { display: flex; }
      
      .mc-area {
        width: 30%;
        height: 100%;
        position: relative;
        pointer-events: auto;
      }
      .mc-btn {
        position: absolute;
        width: 14vh;
        height: 14vh;
        min-width: 50px;
        min-height: 50px;
        max-width: 80px;
        max-height: 80px;
        background: rgba(13, 11, 26, 0.8);
        border: 2px solid rgba(0, 255, 255, 0.4);
        border-radius: 50%;
        color: rgba(0, 255, 255, 0.8);
        font-family: monospace;
        font-weight: bold;
        font-size: 3vh;
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        touch-action: none;
        box-shadow: 0 0 10px rgba(0, 255, 255, 0.2);
        transition: transform 0.1s, background 0.1s, border-color 0.1s;
      }
      .mc-btn:active, .mc-btn.active {
        background: rgba(0, 255, 255, 0.3);
        border-color: #00FFFF;
        color: #fff;
        transform: scale(0.9);
        box-shadow: 0 0 15px rgba(0, 255, 255, 0.6);
      }
      
      /* Left Area */
      #mc-q { top: 25%; left: 15%; }
      #mc-e { top: 25%; right: 15%; }
      #mc-left { bottom: 15%; left: 15%; font-size: 4vh; }
      #mc-right { bottom: 15%; right: 15%; font-size: 4vh; }
      
      /* Right Area */
      #mc-hdrop { top: 25%; left: 15%; font-size: 4vh; }
      #mc-r { top: 25%; right: 15%; }
      #mc-ccw { top: 55%; left: 15%; font-size: 4vh; }
      #mc-cw { top: 55%; right: 15%; font-size: 4vh; }
      #mc-sdrop { bottom: 15%; left: 50%; transform: translateX(-50%); font-size: 4vh; }
      #mc-sdrop:active, #mc-sdrop.active { transform: translateX(-50%) scale(0.9); }
    </style>
    
    <div class="mc-area left-area">
      <div class="mc-btn" id="mc-q" data-key="q">Q</div>
      <div class="mc-btn" id="mc-e" data-key="e">E</div>
      <div class="mc-btn" id="mc-left" data-key="ArrowLeft">‹</div>
      <div class="mc-btn" id="mc-right" data-key="ArrowRight">›</div>
    </div>
    
    <div class="mc-area right-area">
      <div class="mc-btn" id="mc-hdrop" data-key=" ">⤓</div>
      <div class="mc-btn" id="mc-r" data-key="r">R</div>
      <div class="mc-btn" id="mc-ccw" data-key="z">↺</div>
      <div class="mc-btn" id="mc-cw" data-key="x">↻</div>
      <div class="mc-btn" id="mc-sdrop" data-key="ArrowDown">↓</div>
    </div>
  `;
  document.body.appendChild(container);

  const btns = container.querySelectorAll('.mc-btn');
  btns.forEach(btn => {
    const key = btn.getAttribute('data-key');
    if (!key) return;
    
    const triggerKeyDown = (e: Event) => {
      e.preventDefault();
      btn.classList.add('active');
      window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    };
    const triggerKeyUp = (e: Event) => {
      e.preventDefault();
      btn.classList.remove('active');
      window.dispatchEvent(new KeyboardEvent('keyup', { key }));
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
