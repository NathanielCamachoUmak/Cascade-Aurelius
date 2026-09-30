import { supabase } from './supabase';

export type HighScoreModeKey =
  | 'SOLO'
  | 'EASY'
  | 'HARD'
  | 'classic-pvp'
  | 'free-for-all'
  | 'team-deathmatch'
  | 'battle-royale';

export interface HighScoreEntry {
  score: number;
  lines: number;
  timestamp: number;
}

export type HighScoreMap = Partial<Record<HighScoreModeKey, HighScoreEntry[]>>;

const STORAGE_KEY = 'cascade-aurelius-high-scores-v1';
const ALL_MODES: HighScoreModeKey[] = [
  'SOLO',
  'EASY',
  'HARD',
  'classic-pvp',
  'free-for-all',
  'team-deathmatch',
  'battle-royale',
];

function readStore(): HighScoreMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(data: HighScoreMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

function mergeHighScoreMaps(a: HighScoreMap, b: HighScoreMap): HighScoreMap {
  const merged: HighScoreMap = {};
  for (const mode of ALL_MODES) {
    const listA = Array.isArray(a[mode]) ? a[mode]! : [];
    const listB = Array.isArray(b[mode]) ? b[mode]! : [];
    const combined = [...listA, ...listB].filter(
      item => item && typeof item.score === 'number' && item.score > 0
    );
    // Deduplicate entries with identical score + lines + timestamp
    const unique: HighScoreEntry[] = [];
    const seen = new Set<string>();
    for (const entry of combined) {
      const key = `${entry.score}:${entry.lines}:${entry.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(entry);
      }
    }
    unique.sort((x, y) => y.score - x.score || y.lines - x.lines || y.timestamp - x.timestamp);
    if (unique.length > 0) {
      merged[mode] = unique.slice(0, 3);
    }
  }
  return merged;
}

let currentUserId: string | null = null;

async function pushHighScoresToSupabase(userId: string, store: HighScoreMap) {
  try {
    // Read existing settings_and_hotkeys so we never clobber other keys
    const { data: existingRow } = await supabase
      .from('profiles')
      .select('settings_and_hotkeys')
      .eq('id', userId)
      .single();

    const mergedJsonb = {
      ...(existingRow?.settings_and_hotkeys || {}),
      highScores: store,
    };

    // First try updating both the dedicated `high_scores` column and `settings_and_hotkeys`
    const { error } = await supabase
      .from('profiles')
      .update({
        high_scores: store,
        settings_and_hotkeys: mergedJsonb,
      })
      .eq('id', userId);

    // Fallback if the dedicated `high_scores` column hasn't been migrated yet
    if (error) {
      await supabase
        .from('profiles')
        .update({
          settings_and_hotkeys: mergedJsonb,
        })
        .eq('id', userId);
    }
  } catch {
    // Ignore network errors while offline
  }
}

async function syncHighScoresWithCloud(userId: string | null) {
  currentUserId = userId;
  if (!userId) return;

  try {
    let cloudScores: HighScoreMap = {};
    const { data, error } = await supabase
      .from('profiles')
      .select('high_scores, settings_and_hotkeys')
      .eq('id', userId)
      .single();

    if (!error && data) {
      const fromDedicated = (data as any).high_scores as HighScoreMap | undefined;
      const fromJsonb = (data.settings_and_hotkeys as any)?.highScores as HighScoreMap | undefined;
      cloudScores = mergeHighScoreMaps(fromDedicated || {}, fromJsonb || {});
    } else {
      // Fallback if `high_scores` column does not exist yet
      const { data: fallbackData } = await supabase
        .from('profiles')
        .select('settings_and_hotkeys')
        .eq('id', userId)
        .single();
      if (fallbackData?.settings_and_hotkeys) {
        cloudScores = ((fallbackData.settings_and_hotkeys as any).highScores as HighScoreMap) || {};
      }
    }

    const localScores = readStore();
    const merged = mergeHighScoreMaps(localScores, cloudScores);
    writeStore(merged);
    await pushHighScoresToSupabase(userId, merged);
    window.dispatchEvent(new CustomEvent('highScoresUpdated'));
  } catch {
    // Ignore offline errors
  }
}

supabase.auth.getSession().then(({ data: { session } }) => {
  syncHighScoresWithCloud(session?.user?.id ?? null);
});

supabase.auth.onAuthStateChange((_event, session) => {
  syncHighScoresWithCloud(session?.user?.id ?? null);
});

export function getTopScores(mode: HighScoreModeKey): HighScoreEntry[] {
  const store = readStore();
  const list = Array.isArray(store[mode]) ? store[mode]! : [];
  return [...list]
    .sort((a, b) => b.score - a.score || b.lines - a.lines)
    .slice(0, 3);
}

export function getAllHighScores(): HighScoreMap {
  return readStore();
}

export function recordModeScore(
  mode: HighScoreModeKey,
  score: number,
  lines: number = 0
): { rank: number | null; topScores: HighScoreEntry[] } {
  const roundedScore = Math.max(0, Math.round(score));
  const roundedLines = Math.max(0, Math.round(lines));
  const store = readStore();
  const existing = Array.isArray(store[mode]) ? store[mode]! : [];

  const newEntry: HighScoreEntry = {
    score: roundedScore,
    lines: roundedLines,
    timestamp: Date.now(),
  };

  const updated = [...existing, newEntry]
    .sort((a, b) => b.score - a.score || b.lines - a.lines || b.timestamp - a.timestamp)
    .slice(0, 3);

  store[mode] = updated;
  writeStore(store);

  if (currentUserId) {
    void pushHighScoresToSupabase(currentUserId, store);
  }
  window.dispatchEvent(new CustomEvent('highScoresUpdated'));

  const idx = updated.findIndex(item => item === newEntry);
  return {
    rank: idx >= 0 ? idx + 1 : null,
    topScores: updated,
  };
}

let popupEl: HTMLElement | null = null;

function ensurePopupElement(): HTMLElement {
  if (popupEl && document.body.contains(popupEl)) return popupEl;
  popupEl = document.createElement('div');
  popupEl.id = 'mode-highscore-popup';
  popupEl.className =
    'fixed z-[140] hidden pointer-events-none w-64 rounded-xl border bg-[#0b0d1c]/95 p-4 text-left shadow-[0_12px_35px_rgba(0,0,0,0.85)] backdrop-blur-md transition-opacity duration-150 opacity-0';
  document.body.appendChild(popupEl);
  return popupEl;
}

export function hideHighScorePopup() {
  if (!popupEl) return;
  popupEl.classList.add('hidden', 'opacity-0');
  popupEl.classList.remove('opacity-100');
}

export function attachHighScoreHoverPopup(
  element: HTMLElement | null,
  mode: HighScoreModeKey,
  modeLabel: string,
  accentHex: string = '#00FFFF'
) {
  if (!element) return;

  const showPopup = () => {
    const popup = ensurePopupElement();
    const topScores = getTopScores(mode);
    const rankColors = ['#FFD700', '#E5E7EB', '#D97706'];

    const rowsHtml = [0, 1, 2]
      .map(i => {
        const entry = topScores[i];
        const rankColor = rankColors[i];
        if (!entry) {
          return `
            <div class="flex items-center justify-between py-1.5 border-b border-white/5 last:border-b-0 text-xs">
              <span class="font-bold tracking-wider" style="color: ${rankColor}">#${i + 1}</span>
              <span class="text-gray-500 italic text-[11px]">No score yet</span>
            </div>
          `;
        }
        return `
          <div class="flex items-center justify-between py-1.5 border-b border-white/5 last:border-b-0 text-xs">
            <span class="font-bold tracking-wider" style="color: ${rankColor}">#${i + 1}</span>
            <div class="text-right">
              <span class="font-pixel text-[11px] text-white">${entry.score.toLocaleString()}</span>
              <span class="text-[9px] text-gray-400 uppercase ml-1.5">${entry.lines}L</span>
            </div>
          </div>
        `;
      })
      .join('');

    popup.style.borderColor = accentHex;
    popup.style.boxShadow = `0 12px 35px rgba(0,0,0,0.85), 0 0 20px ${accentHex}26`;
    popup.innerHTML = `
      <div class="flex items-center justify-between mb-2 pb-1.5 border-b border-white/10">
        <span class="text-[10px] font-black uppercase tracking-[0.16em]" style="color: ${accentHex}">${modeLabel}</span>
        <span class="text-[9px] font-bold uppercase tracking-widest text-gray-400">Top 3 Scores</span>
      </div>
      <div class="flex flex-col">
        ${rowsHtml}
      </div>
    `;

    popup.classList.remove('hidden');

    const rect = element.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const margin = 10;

    let left = rect.left + rect.width / 2 - popupRect.width / 2;
    left = Math.max(12, Math.min(window.innerWidth - popupRect.width - 12, left));

    let top = rect.top - popupRect.height - margin;
    if (top < 16) {
      top = rect.bottom + margin;
    }

    popup.style.left = `${Math.round(left)}px`;
    popup.style.top = `${Math.round(top)}px`;

    requestAnimationFrame(() => {
      popup.classList.remove('opacity-0');
      popup.classList.add('opacity-100');
    });
  };

  element.addEventListener('mouseenter', showPopup);
  element.addEventListener('mouseleave', hideHighScorePopup);
  element.addEventListener('click', hideHighScorePopup);
}
