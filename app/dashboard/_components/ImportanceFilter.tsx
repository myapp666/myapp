'use client';

import { useEffect, useState } from 'react';

// 重要度档位。顺序按"高 → 低"展示，与现有 dashboard 配色保持一致。
export const IMPORTANCE_LEVELS = ['高', '中', '低'] as const;
export type Importance = (typeof IMPORTANCE_LEVELS)[number];

const STORAGE_KEY = 'importanceFilter:v1';
// 默认隐藏"低"，避免低价值噪声刷屏。用户可在 UI 上自行打开。
const DEFAULT_LEVELS: ReadonlySet<Importance> = new Set<Importance>(['高', '中']);

const LEVEL_STYLE: Record<Importance, { active: string; inactive: string; dot: string }> = {
  高: {
    active: 'bg-red-600 text-white border-red-600',
    inactive: 'bg-white text-red-700 border-red-200 hover:bg-red-50',
    dot: 'bg-red-500',
  },
  中: {
    active: 'bg-amber-500 text-white border-amber-500',
    inactive: 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50',
    dot: 'bg-amber-500',
  },
  低: {
    active: 'bg-emerald-600 text-white border-emerald-600',
    inactive: 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50',
    dot: 'bg-emerald-500',
  },
};

interface ImportanceFilterProps {
  value: Set<Importance>;
  onChange: (next: Set<Importance>) => void;
  counts?: Partial<Record<Importance, number>>;
}

// 重要度筛选器：高/中/低 三个药丸 + "全部"快捷开关
export function ImportanceFilter({ value, onChange, counts }: ImportanceFilterProps) {
  const toggle = (level: Importance) => {
    const next = new Set(value);
    if (next.has(level)) next.delete(level);
    else next.add(level);
    onChange(next);
  };

  const allOn = value.size === IMPORTANCE_LEVELS.length;
  const toggleAll = () => {
    if (allOn) onChange(new Set());
    else onChange(new Set(IMPORTANCE_LEVELS));
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-slate-500">重要度筛选</span>
      <button
        type="button"
        onClick={toggleAll}
        aria-pressed={allOn}
        className={`px-3 py-1 text-xs rounded-full border transition ${
          allOn
            ? 'bg-slate-800 text-white border-slate-800'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
        }`}
      >
        全部
      </button>
      {IMPORTANCE_LEVELS.map((level) => {
        const active = value.has(level);
        const s = LEVEL_STYLE[level];
        return (
          <button
            key={level}
            type="button"
            onClick={() => toggle(level)}
            aria-pressed={active}
            className={`px-3 py-1 text-xs rounded-full border transition flex items-center gap-1.5 ${
              active ? s.active : s.inactive
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white/80' : s.dot}`} />
            <span>{level}</span>
            {counts && (
              <span
                className={`text-[10px] tabular-nums ${active ? 'opacity-80' : 'opacity-60'}`}
              >
                {counts[level] ?? 0}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// 带 localStorage 持久化的 hook：跨页面、跨刷新都保留用户选择
export function useImportanceFilter(): readonly [
  Set<Importance>,
  (next: Set<Importance>) => void,
] {
  const [value, setValue] = useState<Set<Importance>>(() => new Set(DEFAULT_LEVELS));
  const [hydrated, setHydrated] = useState(false);

  // mount 时从 localStorage 读
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((l): l is Importance =>
            IMPORTANCE_LEVELS.includes(l as Importance),
          );
          setValue(new Set(filtered));
        }
      }
    } catch {
      // localStorage 不可用时静默忽略
    }
    setHydrated(true);
  }, []);

  // 后续变更时写回
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...value]));
    } catch {
      // ignore
    }
  }, [value, hydrated]);

  return [value, setValue] as const;
}

// 纯客户端筛选：null/undefined/未知值 视为"未知"档，始终保留显示
export function matchesImportanceFilter(
  importance: string | null | undefined,
  filter: Set<Importance>,
): boolean {
  if (!importance) return true; // 无重要度信息的一律显示
  if (!IMPORTANCE_LEVELS.includes(importance as Importance)) return true;
  return filter.has(importance as Importance);
}