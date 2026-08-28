/**
 * Drop-in responsive online mode selector for Block Quartet.
 *
 * Minimal integration:
 *
 *   import { mountOnlineModeSelect } from './OnlineModeSelect';
 *
 *   const modeSelect = mountOnlineModeSelect({
 *     container: document.getElementById('screen-online-mode-select')!,
 *     onConfirm: (mode) => {
 *       // Use mode.id to route to your existing lobby / matchmaking code.
 *       // Example: openOnlineLobby(mode.id);
 *     },
 *     onBack: () => showMainMenu(),
 *   });
 *
 * The component injects its own scoped CSS and adapts from a three-column
 * layout to a single-column layout on narrow screens. It has no dependencies.
 */

export type OnlineModeId = 'classic-pvp' | 'free-for-all' | 'team-deathmatch';

export interface OnlineGameMode {
  id: OnlineModeId;
  title: string;
  format: string;
  playerCount: number;
  description: string;
  winCondition: string;
  accent: 'cyan' | 'yellow' | 'magenta';
}

export const ONLINE_GAME_MODES: readonly OnlineGameMode[] = [
  {
    id: 'classic-pvp',
    title: 'Classic PvP',
    format: '1v1',
    playerCount: 2,
    description: 'A direct head-to-head Tetris battle.',
    winCondition: 'Be the last board standing.',
    accent: 'cyan',
  },
  {
    id: 'free-for-all',
    title: 'Free For All',
    format: '1v1v1v1',
    playerCount: 4,
    description: 'Four players. No teams. Every clear matters.',
    winCondition: 'Be the last board standing.',
    accent: 'yellow',
  },
  {
    id: 'team-deathmatch',
    title: '3v3 Deathmatch',
    format: '3v3',
    playerCount: 6,
    description: 'Cyan Circuit versus Magenta Voltage.',
    winCondition: 'Highest combined team score at the horn.',
    accent: 'magenta',
  },
] as const;

export interface ModeAvailability {
  enabled: boolean;
  note?: string;
}

export interface OnlineModeSelectOptions {
  /** The empty existing screen/container where the selector should be mounted. */
  container: HTMLElement | string;
  /** Called when the player presses Continue. Route this selection into your lobby logic. */
  onConfirm: (mode: OnlineGameMode) => void;
  /** Optional callback for a Back button. Omit it if your screen has its own navigation. */
  onBack?: () => void;
  /** Defaults to Classic PvP. */
  initialMode?: OnlineModeId;
  /** Optional visible heading. */
  title?: string;
  /** Optional visible description. */
  subtitle?: string;
  /** Modes can be temporarily disabled without changing the layout. */
  availability?: Partial<Record<OnlineModeId, ModeAvailability>>;
}

export interface OnlineModeSelectController {
  getSelectedMode(): OnlineGameMode;
  selectMode(modeId: OnlineModeId): void;
  setAvailability(modeId: OnlineModeId, availability: ModeAvailability): void;
  destroy(): void;
}

const STYLE_ID = 'bq-online-mode-select-style';

function resolveContainer(target: HTMLElement | string): HTMLElement {
  if (typeof target !== 'string') return target;
  const element = document.querySelector<HTMLElement>(target);
  if (!element) throw new Error(`OnlineModeSelect could not find container: ${target}`);
  return element;
}

function getMode(modeId: OnlineModeId): OnlineGameMode {
  const mode = ONLINE_GAME_MODES.find(item => item.id === modeId);
  if (!mode) throw new Error(`Unknown online mode: ${modeId}`);
  return mode;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .bq-mode-select {
      --bq-bg: #08091d;
      --bq-panel: rgba(16, 18, 51, 0.88);
      --bq-line: rgba(169, 176, 255, 0.23);
      --bq-text: #f4f6ff;
      --bq-muted: #a4aac5;
      --bq-cyan: #00e5ff;
      --bq-yellow: #ffc107;
      --bq-magenta: #ff007f;
      color: var(--bq-text);
      width: min(100%, 1100px);
      margin: 0 auto;
      padding: clamp(1rem, 4vw, 3rem);
      box-sizing: border-box;
      background:
        radial-gradient(circle at 18% 0%, rgba(0, 229, 255, 0.11), transparent 32rem),
        radial-gradient(circle at 86% 100%, rgba(255, 0, 127, 0.12), transparent 28rem),
        var(--bq-bg);
      border: 1px solid var(--bq-line);
      border-radius: 18px;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 18px 55px rgba(0, 0, 0, 0.38);
    }
    .bq-mode-select * { box-sizing: border-box; }
    .bq-mode-select__eyebrow { color: var(--bq-cyan); font-size: .72rem; font-weight: 800; letter-spacing: .18em; margin: 0 0 .65rem; text-transform: uppercase; }
    .bq-mode-select__title { font-size: clamp(1.7rem, 5vw, 3.25rem); line-height: 1; margin: 0; letter-spacing: -.045em; }
    .bq-mode-select__subtitle { color: var(--bq-muted); font-size: clamp(.95rem, 2vw, 1.08rem); line-height: 1.65; margin: .8rem 0 1.8rem; max-width: 44rem; }
    .bq-mode-select__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
    .bq-mode-select__card {
      --mode-color: var(--bq-cyan);
      appearance: none;
      min-height: 250px;
      width: 100%;
      padding: 1.2rem;
      text-align: left;
      color: var(--bq-text);
      background: linear-gradient(155deg, rgba(35, 39, 84, .84), rgba(12, 13, 36, .92));
      border: 1px solid var(--bq-line);
      border-radius: 14px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: .7rem;
      position: relative;
      transition: border-color 160ms ease-out, box-shadow 160ms ease-out, transform 160ms ease-out, opacity 160ms ease-out;
    }
    .bq-mode-select__card:hover:not(:disabled), .bq-mode-select__card:focus-visible { border-color: var(--mode-color); box-shadow: 0 0 0 3px color-mix(in srgb, var(--mode-color) 18%, transparent), 0 14px 26px rgba(0,0,0,.26); outline: none; transform: translateY(-3px); }
    .bq-mode-select__card[aria-checked="true"] { border-color: var(--mode-color); box-shadow: inset 0 0 0 1px var(--mode-color), 0 0 26px color-mix(in srgb, var(--mode-color) 20%, transparent); }
    .bq-mode-select__card:disabled { cursor: not-allowed; opacity: .48; }
    .bq-mode-select__card[data-accent="yellow"] { --mode-color: var(--bq-yellow); }
    .bq-mode-select__card[data-accent="magenta"] { --mode-color: var(--bq-magenta); }
    .bq-mode-select__format { color: var(--mode-color); font-size: .72rem; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
    .bq-mode-select__mode-title { font-size: clamp(1.25rem, 2.3vw, 1.55rem); font-weight: 800; line-height: 1.15; margin: 0; }
    .bq-mode-select__description { color: var(--bq-muted); font-size: .92rem; line-height: 1.55; margin: 0; }
    .bq-mode-select__rule { color: var(--mode-color); border-top: 1px solid var(--bq-line); font-size: .74rem; font-weight: 700; letter-spacing: .02em; line-height: 1.45; margin-top: auto; padding-top: .8rem; }
    .bq-mode-select__note { color: #ffcedf; font-size: .75rem; font-weight: 700; margin: 0; }
    .bq-mode-select__selection { color: var(--bq-muted); font-size: .9rem; margin: 1.25rem 0 0; }
    .bq-mode-select__selection strong { color: var(--bq-text); }
    .bq-mode-select__actions { display: flex; flex-wrap: wrap; gap: .75rem; justify-content: flex-end; margin-top: 1.25rem; }
    .bq-mode-select__button { appearance: none; border-radius: 10px; cursor: pointer; font: inherit; font-size: .88rem; font-weight: 850; letter-spacing: .07em; min-height: 46px; padding: 0 1.15rem; text-transform: uppercase; transition: transform 140ms ease-out, filter 140ms ease-out; }
    .bq-mode-select__button:active { transform: scale(.97); }
    .bq-mode-select__button:focus-visible { outline: 3px solid var(--bq-cyan); outline-offset: 3px; }
    .bq-mode-select__button--back { background: transparent; border: 1px solid var(--bq-line); color: var(--bq-text); margin-right: auto; }
    .bq-mode-select__button--confirm { background: var(--bq-cyan); border: 1px solid var(--bq-cyan); color: #061019; }
    .bq-mode-select__button:hover:not(:disabled) { filter: brightness(1.1); }
    .bq-mode-select__button:disabled { cursor: not-allowed; opacity: .5; }
    @media (max-width: 760px) {
      .bq-mode-select { border-radius: 0; border-left: 0; border-right: 0; min-height: 100dvh; padding: 1.25rem; }
      .bq-mode-select__grid { grid-template-columns: 1fr; }
      .bq-mode-select__card { min-height: 190px; }
      .bq-mode-select__actions { justify-content: stretch; }
      .bq-mode-select__button { flex: 1 1 100%; }
      .bq-mode-select__button--back { margin-right: 0; order: 2; }
    }
    @media (prefers-reduced-motion: reduce) {
      .bq-mode-select__card, .bq-mode-select__button { transition: none; }
    }
  `;
  document.head.appendChild(style);
}

export function mountOnlineModeSelect(options: OnlineModeSelectOptions): OnlineModeSelectController {
  ensureStyles();
  const container = resolveContainer(options.container);
  const availability = new Map<OnlineModeId, ModeAvailability>();
  ONLINE_GAME_MODES.forEach(mode => availability.set(mode.id, options.availability?.[mode.id] ?? { enabled: true }));

  let selectedId = options.initialMode ?? 'classic-pvp';
  if (!availability.get(selectedId)?.enabled) {
    selectedId = ONLINE_GAME_MODES.find(mode => availability.get(mode.id)?.enabled)?.id ?? 'classic-pvp';
  }

  const root = document.createElement('section');
  root.className = 'bq-mode-select';
  root.setAttribute('aria-label', 'Online game mode selection');

  const eyebrow = document.createElement('p');
  eyebrow.className = 'bq-mode-select__eyebrow';
  eyebrow.textContent = 'Online matchmaking';
  const heading = document.createElement('h2');
  heading.className = 'bq-mode-select__title';
  heading.textContent = options.title ?? 'Choose your battle';
  const subtitle = document.createElement('p');
  subtitle.className = 'bq-mode-select__subtitle';
  subtitle.textContent = options.subtitle ?? 'Select a mode before entering the lobby. Match rules and required player counts are shown below.';
  const grid = document.createElement('div');
  grid.className = 'bq-mode-select__grid';
  grid.setAttribute('role', 'radiogroup');
  grid.setAttribute('aria-label', 'Online game modes');
  const selection = document.createElement('p');
  selection.className = 'bq-mode-select__selection';
  const actions = document.createElement('div');
  actions.className = 'bq-mode-select__actions';

  const cards = new Map<OnlineModeId, HTMLButtonElement>();
  const notes = new Map<OnlineModeId, HTMLParagraphElement>();

  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.className = 'bq-mode-select__button bq-mode-select__button--confirm';
  confirmButton.textContent = 'Continue to Lobby';
  confirmButton.addEventListener('click', () => {
    const selected = getMode(selectedId);
    if (availability.get(selected.id)?.enabled) options.onConfirm(selected);
  });

  if (options.onBack) {
    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'bq-mode-select__button bq-mode-select__button--back';
    backButton.textContent = 'Back';
    backButton.addEventListener('click', options.onBack);
    actions.appendChild(backButton);
  }
  actions.appendChild(confirmButton);

  function updateSelection() {
    const selected = getMode(selectedId);
    const available = availability.get(selected.id) ?? { enabled: true };
    cards.forEach((card, modeId) => {
      const isSelected = modeId === selectedId;
      card.setAttribute('aria-checked', String(isSelected));
      card.tabIndex = isSelected ? 0 : -1;
      card.disabled = !(availability.get(modeId)?.enabled ?? true);
    });
    selection.innerHTML = `Selected: <strong>${selected.title}</strong> · ${selected.playerCount} players · ${selected.winCondition}`;
    confirmButton.disabled = !available.enabled;
  }

  function selectMode(modeId: OnlineModeId) {
    if (!availability.get(modeId)?.enabled) return;
    selectedId = modeId;
    updateSelection();
  }

  ONLINE_GAME_MODES.forEach((mode, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'bq-mode-select__card';
    card.dataset.accent = mode.accent;
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-label', `${mode.title}, ${mode.playerCount} players. ${mode.winCondition}`);
    card.addEventListener('click', () => selectMode(mode.id));
    card.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      const enabledModes = ONLINE_GAME_MODES.filter(item => availability.get(item.id)?.enabled);
      const currentIndex = enabledModes.findIndex(item => item.id === selectedId);
      const next = enabledModes[(currentIndex + direction + enabledModes.length) % enabledModes.length];
      if (next) {
        selectMode(next.id);
        cards.get(next.id)?.focus();
      }
    });

    const format = document.createElement('span');
    format.className = 'bq-mode-select__format';
    format.textContent = `${mode.format} · ${mode.playerCount} players`;
    const title = document.createElement('h3');
    title.className = 'bq-mode-select__mode-title';
    title.textContent = mode.title;
    const description = document.createElement('p');
    description.className = 'bq-mode-select__description';
    description.textContent = mode.description;
    const rule = document.createElement('p');
    rule.className = 'bq-mode-select__rule';
    rule.textContent = mode.winCondition;
    const note = document.createElement('p');
    note.className = 'bq-mode-select__note';

    card.append(format, title, description, rule, note);
    grid.appendChild(card);
    cards.set(mode.id, card);
    notes.set(mode.id, note);
    if (index === 0) card.tabIndex = 0;
  });

  function setAvailability(modeId: OnlineModeId, next: ModeAvailability) {
    availability.set(modeId, next);
    const note = notes.get(modeId);
    if (note) note.textContent = next.enabled ? '' : (next.note ?? 'Temporarily unavailable');
    if (!availability.get(selectedId)?.enabled) {
      const fallback = ONLINE_GAME_MODES.find(mode => availability.get(mode.id)?.enabled);
      if (fallback) selectedId = fallback.id;
    }
    updateSelection();
  }

  root.append(eyebrow, heading, subtitle, grid, selection, actions);
  container.replaceChildren(root);
  ONLINE_GAME_MODES.forEach(mode => setAvailability(mode.id, availability.get(mode.id) ?? { enabled: true }));
  updateSelection();

  return {
    getSelectedMode: () => getMode(selectedId),
    selectMode,
    setAvailability,
    destroy: () => root.remove(),
  };
}
