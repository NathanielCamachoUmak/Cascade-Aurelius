export const InputAction = {
  LEFT: "LEFT",
  RIGHT: "RIGHT",
  ROTATE_CW: "ROTATE_CW",
  ROTATE_CCW: "ROTATE_CCW",
  SOFT_DROP: "SOFT_DROP",
  HARD_DROP: "HARD_DROP",
  HOLD: "HOLD",
} as const;
export type InputAction = typeof InputAction[keyof typeof InputAction];

export class InputHandler {
  private inputQueue: InputAction[] = [];
  private keysDown: Set<string> = new Set();
  
  // Maps keyboard keys to InputActions
  private keyMap: Record<string, InputAction> = {
    "ArrowLeft": InputAction.LEFT,
    "ArrowRight": InputAction.RIGHT,
    "ArrowDown": InputAction.SOFT_DROP,
    " ": InputAction.HARD_DROP,
    "ArrowUp": InputAction.ROTATE_CW,
    "x": InputAction.ROTATE_CW,
    "z": InputAction.ROTATE_CCW,
    "c": InputAction.HOLD,
    "C": InputAction.HOLD,
  };

  // DAS (Delayed Auto Shift) and ARR (Auto Repeat Rate) settings in ms
  private readonly DAS_DELAY = 170; // Time before repeat starts
  private readonly ARR_DELAY = 50;  // Time between repeated inputs

  // State tracking for held keys
  private heldActions: Record<InputAction, { active: boolean, dasTimer: number, arrTimer: number }> = {
    [InputAction.LEFT]: { active: false, dasTimer: 0, arrTimer: 0 },
    [InputAction.RIGHT]: { active: false, dasTimer: 0, arrTimer: 0 },
    [InputAction.SOFT_DROP]: { active: false, dasTimer: 0, arrTimer: 0 },
    [InputAction.HARD_DROP]: { active: false, dasTimer: 0, arrTimer: 0 },
    [InputAction.ROTATE_CW]: { active: false, dasTimer: 0, arrTimer: 0 },
    [InputAction.ROTATE_CCW]: { active: false, dasTimer: 0, arrTimer: 0 },
    [InputAction.HOLD]: { active: false, dasTimer: 0, arrTimer: 0 }
  };

  constructor(listenToKeyboard: boolean = true) {
    if (listenToKeyboard) {
      this.initListeners();
    }
  }

  private initListeners() {
    window.addEventListener("keydown", (e) => {
      if (this.keyMap[e.key]) {
        e.preventDefault();
        const action = this.keyMap[e.key];
        
        if (!this.keysDown.has(e.key)) {
          this.keysDown.add(e.key);
          
          // Emit initial press
          this.inputQueue.push(action);
          
          // Reset DAS state
          this.heldActions[action].active = true;
          this.heldActions[action].dasTimer = 0;
          this.heldActions[action].arrTimer = 0;
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      if (this.keyMap[e.key]) {
        e.preventDefault();
        this.keysDown.delete(e.key);
        
        const action = this.keyMap[e.key];
        // Check if any other physical key mapped to this action is still down
        // (e.g., releasing 'ArrowUp' while holding 'x')
        let stillActive = false;
        for (const [key, mappedAction] of Object.entries(this.keyMap)) {
          if (mappedAction === action && this.keysDown.has(key)) {
            stillActive = true;
            break;
          }
        }
        this.heldActions[action].active = stillActive;
      }
    });
  }

  /**
   * Called every frame to process DAS (Delayed Auto Shift)
   */
  public update(dt: number) {
    // Only apply auto-repeat to movement and soft drops
    const repeatableActions = [InputAction.LEFT, InputAction.RIGHT, InputAction.SOFT_DROP];

    for (const action of repeatableActions) {
      const state = this.heldActions[action];
      if (state.active) {
        state.dasTimer += dt;
        
        // If we've held it long enough to pass DAS threshold
        if (state.dasTimer >= this.DAS_DELAY) {
          state.arrTimer += dt;
          
          // If we've passed the ARR threshold, push an input and subtract the threshold
          while (state.arrTimer >= this.ARR_DELAY) {
            this.inputQueue.push(action);
            state.arrTimer -= this.ARR_DELAY;
          }
        }
      }
    }
  }

  public getNextInput(): InputAction | undefined {
    return this.inputQueue.shift();
  }

  public pushInput(action: InputAction) {
    this.inputQueue.push(action);
  }

  public hasInput(): boolean {
    return this.inputQueue.length > 0;
  }

  public clear() {
    this.inputQueue = [];
    this.keysDown.clear();
    for (const action in this.heldActions) {
      this.heldActions[action as InputAction].active = false;
    }
  }
} 