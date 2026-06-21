import React, { useMemo } from 'react';
import { PieChart, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { MaintenanceItem } from '@/data/proModData';
import { getCategoryColor, CustomCategory } from '@/data/maintenanceCategories';

// ============================================================
// Category Breakdown analytics card
// ============================================================
// Groups maintenance items by category and shows, per category, the
// count of Overdue / Due / Good items. Each category row is accented
// with that category's assigned color (a small horizontal bar sized by
// item count + a color dot) so users get quick visual insight into
// where their attention is needed.

interface CategoryBreakdownCardProps {
  items: MaintenanceItem[]; // already status-computed
  customCategories: CustomCategory[];
}

interface CatStat {
  name: string;
  color: string;
  total: number;
  overdue: number;
  due: number;
  good: number;
}

const CategoryBreakdownCard: React.FC<CategoryBreakdownCardProps> = ({
  items,
  customCategories,
}) => {
  const stats: CatStat[] = useMemo(() => {
    const map = new Map<string, CatStat>();
    for (const item of items) {
      const name = item.category || 'Uncategorized';
      if (!map.has(name)) {
        map.set(name, {
          name,
          color: getCategoryColor(name, customCategories),
          total: 0,
          overdue: 0,
          due: 0,
          good: 0,
        });
      }
      const s = map.get(name)!;
      s.total += 1;
      // "Due Soon" is grouped with "Due" for the breakdown so the three
      // buckets line up with the summary cards' intent (needs attention).
      if (item.status === 'Overdue') s.overdue += 1;
      else if (item.status === 'Due' || item.status === 'Due Soon') s.due += 1;
      else s.good += 1;
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [items, customCategories]);

  const maxTotal = useMemo(
    () => stats.reduce((m, s) => Math.max(m, s.total), 0),
    [stats]
  );

  if (stats.length === 0) return null;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <PieChart className="w-5 h-5 text-cyan-400" />
          Category Breakdown
        </h3>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Overdue
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Due
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Good
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {stats.map((s) => {
          const widthPct = maxTotal > 0 ? (s.total / maxTotal) * 100 : 0;
          // Status split within the category's bar.
          const overduePct = s.total > 0 ? (s.overdue / s.total) * 100 : 0;
          const duePct = s.total > 0 ? (s.due / s.total) * 100 : 0;
          const goodPct = s.total > 0 ? (s.good / s.total) * 100 : 0;
          return (
            <div key={s.name}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-sm text-white truncate">{s.name}</span>
                  <span className="text-xs text-slate-500">({s.total})</span>
                </div>
                <div className="flex items-center gap-2 text-xs flex-shrink-0">
                  {s.overdue > 0 && (
                    <span className="flex items-center gap-1 text-red-400">
                      <AlertTriangle className="w-3 h-3" />
                      {s.overdue}
                    </span>
                  )}
                  {s.due > 0 && (
                    <span className="flex items-center gap-1 text-orange-400">
                      <Clock className="w-3 h-3" />
                      {s.due}
                    </span>
                  )}
                  {s.good > 0 && (
                    <span className="flex items-center gap-1 text-green-400">
                      <CheckCircle className="w-3 h-3" />
                      {s.good}
                    </span>
                  )}
                </div>
              </div>
              {/* Outer bar width is proportional to the category's item count
                  (relative to the largest category); inner segments show the
                  status split. The category color frames the bar. */}
              <div
                className="h-2.5 rounded-full overflow-hidden flex"
                style={{
                  width: `${Math.max(widthPct, 6)}%`,
                  backgroundColor: `${s.color}22`,
                  boxShadow: `inset 0 0 0 1px ${s.color}55`,
                }}
              >
                {overduePct > 0 && (
                  <div className="h-full bg-red-500" style={{ width: `${overduePct}%` }} />
                )}
                {duePct > 0 && (
                  <div className="h-full bg-orange-500" style={{ width: `${duePct}%` }} />
                )}
                {goodPct > 0 && (
                  <div className="h-full bg-green-500" style={{ width: `${goodPct}%` }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryBreakdownCard;
