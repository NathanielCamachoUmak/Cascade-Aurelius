export const InputAction = {
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  ROTATE_CW: 'ROTATE_CW',
  ROTATE_CCW: 'ROTATE_CCW',
  SOFT_DROP: 'SOFT_DROP',
  HARD_DROP: 'HARD_DROP',
  HOLD: 'HOLD',
  ABILITY_Q: 'ABILITY_Q',
  ABILITY_E: 'ABILITY_E',
  ULTIMATE: 'ULTIMATE',
  TARGET_NEXT: 'TARGET_NEXT',
} as const;
export type InputAction = typeof InputAction[keyof typeof InputAction];

export class InputHandler {
  private inputQueue: InputAction[] = [];
  private keysDown = new Set<string>();
  public isFrozen = false;
  private freezeTimer = 0;
  private reverseTimer = 0;

  private keyMap: Record<string, InputAction> = {
    ArrowLeft: InputAction.LEFT,
    ArrowRight: InputAction.RIGHT,
    ArrowDown: InputAction.SOFT_DROP,
    ' ': InputAction.HARD_DROP,
    ArrowUp: InputAction.ROTATE_CW,
    x: InputAction.ROTATE_CW,
    z: InputAction.ROTATE_CCW,
    c: InputAction.HOLD,
    C: InputAction.HOLD,
    q: InputAction.ABILITY_Q,
    Q: InputAction.ABILITY_Q,
    e: InputAction.ABILITY_E,
    E: InputAction.ABILITY_E,
    r: InputAction.ULTIMATE,
    R: InputAction.ULTIMATE,
    Shift: InputAction.ULTIMATE,
    Tab: InputAction.TARGET_NEXT,
  };

  private readonly DAS_DELAY = 170;
  private readonly ARR_DELAY = 50;
  private heldActions: Record<InputAction, { active: boolean; dasTimer: number; arrTimer: number }> = Object.values(InputAction).reduce((state, action) => {
    state[action] = { active: false, dasTimer: 0, arrTimer: 0 };
    return state;
  }, {} as Record<InputAction, { active: boolean; dasTimer: number; arrTimer: number }>);

  constructor(listenToKeyboard = true) {
    if (listenToKeyboard) this.initListeners();
  }

  private initListeners() {
    window.addEventListener('keydown', event => {
      if (this.isFrozen) return;
      const action = this.keyMap[event.key];
      if (!action) return;
      event.preventDefault();
      if (this.keysDown.has(event.key)) return;
      this.keysDown.add(event.key);
      this.inputQueue.push(action);
      this.heldActions[action].active = true;
      this.heldActions[action].dasTimer = 0;
      this.heldActions[action].arrTimer = 0;
    });
    window.addEventListener('keyup', event => {
      const action = this.keyMap[event.key];
      if (!action) return;
      event.preventDefault();
      this.keysDown.delete(event.key);
      this.heldActions[action].active = Object.entries(this.keyMap).some(([key, mapped]) => mapped === action && this.keysDown.has(key));
    });
  }

  public update(dt: number) {
    if (this.freezeTimer > 0) {
      this.freezeTimer = Math.max(0, this.freezeTimer - dt);
      if (this.freezeTimer === 0) this.isFrozen = false;
      return;
    }
    if (this.isFrozen) return;
    this.reverseTimer = Math.max(0, this.reverseTimer - dt);
    for (const action of [InputAction.LEFT, InputAction.RIGHT, InputAction.SOFT_DROP]) {
      const state = this.heldActions[action];
      if (!state.active) continue;
      state.dasTimer += dt;
      if (state.dasTimer < this.DAS_DELAY) continue;
      state.arrTimer += dt;
      while (state.arrTimer >= this.ARR_DELAY) {
        this.inputQueue.push(action);
        state.arrTimer -= this.ARR_DELAY;
      }
    }
  }

  public getNextInput(): InputAction | undefined {
    const action = this.inputQueue.shift();
    if (this.reverseTimer <= 0 || !action) return action;
    if (action === InputAction.LEFT) return InputAction.RIGHT;
    if (action === InputAction.RIGHT) return InputAction.LEFT;
    return action;
  }

  public hasInput() { return this.inputQueue.length > 0; }
  public pushInput(action: InputAction) { this.inputQueue.push(action); }
  public freeze() { this.isFrozen = true; this.freezeTimer = 0; this.clear(); }
  public freezeFor(durationMs: number) { this.isFrozen = true; this.freezeTimer = durationMs; this.clear(); }
  public reverseFor(durationMs: number) { this.reverseTimer = Math.max(this.reverseTimer, durationMs); this.clear(); }
  public unfreeze() { this.isFrozen = false; this.freezeTimer = 0; }
  public clear() {
    this.inputQueue = [];
    this.keysDown.clear();
    for (const action of Object.values(InputAction)) this.heldActions[action].active = false;
  }
}
