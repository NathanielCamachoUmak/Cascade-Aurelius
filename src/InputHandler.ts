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
  };

  constructor() {
    this.initListeners();
  }

  private initListeners() {
    window.addEventListener("keydown", (e) => {
      // Prevent default scrolling for game keys
      if (this.keyMap[e.key]) {
        e.preventDefault();
        
        // Prevent auto-repeat from spamming actions for rotation/hard drop
        if (!this.keysDown.has(e.key)) {
          this.keysDown.add(e.key);
          this.inputQueue.push(this.keyMap[e.key]);
        } else {
          // Allow holding down arrow keys for movement, queueing them repeatedly
          // You might implement DAS (Delayed Auto Shift) here for better feel,
          // but for basic buffer we just push movement keys if they are held.
          if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowDown") {
            this.inputQueue.push(this.keyMap[e.key]);
          }
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      if (this.keyMap[e.key]) {
        e.preventDefault();
        this.keysDown.delete(e.key);
      }
    });
  }

  public getNextInput(): InputAction | undefined {
    return this.inputQueue.shift();
  }

  public hasInput(): boolean {
    return this.inputQueue.length > 0;
  }

  public clear() {
    this.inputQueue = [];
  }
}
