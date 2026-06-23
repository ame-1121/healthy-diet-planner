import type { WeeklyMealPlan, DayMealPlan, MealSlot, MealEntry } from '../types';

const DAYS = [
  { key: 'monday', label: '周一' },
  { key: 'tuesday', label: '周二' },
  { key: 'wednesday', label: '周三' },
  { key: 'thursday', label: '周四' },
  { key: 'friday', label: '周五' },
  { key: 'saturday', label: '周六' },
  { key: 'sunday', label: '周日' },
] as const;

const MEALS: { key: MealSlot; label: string; emoji: string }[] = [
  { key: 'breakfast', label: '早餐', emoji: '🌅' },
  { key: 'lunch', label: '午餐', emoji: '☀️' },
  { key: 'dinner', label: '晚餐', emoji: '🌙' },
  { key: 'snack', label: '加餐', emoji: '🍪' },
];

const CARB_PHASE_LABELS: Record<string, { emoji: string; bg: string; text: string }> = {
  'high-carb': { emoji: '🟢', bg: 'bg-green-900/40', text: 'text-green-300' },
  'medium-carb': { emoji: '🟡', bg: 'bg-yellow-900/40', text: 'text-yellow-300' },
  'low-carb': { emoji: '🟠', bg: 'bg-orange-900/40', text: 'text-orange-300' },
  'no-carb': { emoji: '🔴', bg: 'bg-red-900/40', text: 'text-red-300' },
};

interface Props {
  plan: WeeklyMealPlan;
}

function MealCell({ entries }: { entries: MealEntry[] }) {
  if (!entries || entries.length === 0) {
    return <div className="text-gray-500 text-xs italic">—</div>;
  }
  return (
    <div className="space-y-1">
      {entries.map((entry, i) => (
        <div key={i} className="text-xs leading-relaxed">
          <div className="flex items-center gap-1">
            {entry.fromPantry && (
              <span className="text-emerald-400 text-[10px]" title={`已有食材：${entry.pantryItemName || ''}`}>🏠</span>
            )}
            <span className="text-white font-medium">{entry.name}</span>
            {entry.cookingMethod && (
              <span className="text-[10px] text-gray-500 ml-0.5" title={entry.cookingMethod}>
                {entry.cookingMethod === '即食' || entry.cookingMethod === '生食' ? '🧊' :
                 entry.cookingMethod === '冲泡' ? '☕' :
                 entry.cookingMethod === '外卖' ? '🛵' :
                 entry.cookingMethod === '蒸' ? '♨️' :
                 entry.cookingMethod === '煮' ? '🍲' :
                 entry.cookingMethod === '煎' ? '🍳' :
                 entry.cookingMethod === '炒' ? '🔥' :
                 entry.cookingMethod === '烤' ? '♨️' :
                 entry.cookingMethod === '微波' ? '📡' : '🔪'}
              </span>
            )}
          </div>
          <div className="flex gap-2 text-[10px] text-gray-400">
            <span>{entry.amount}</span>
            <span>{entry.calories}kcal</span>
            <span className="text-red-400/70">P{entry.protein}</span>
            <span className="text-yellow-400/70">C{entry.carbs}</span>
            <span className="text-orange-400/70">F{entry.fat}</span>
          </div>
          {/* 已有食材来源 */}
          {entry.fromPantry && entry.pantryItemName && (
            <div className="text-[10px] text-emerald-500/70 ml-3">
              ← {entry.pantryItemName}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DayColumn({ dayPlan }: { dayPlan: DayMealPlan }) {
  const totals = dayPlan.dailyTotals;
  const phaseStyle = dayPlan.carbCyclePhase ? CARB_PHASE_LABELS[dayPlan.carbCyclePhase] : null;

  return (
    <div className="flex-1 min-w-[160px] border-r border-slate-700 last:border-r-0">
      {/* 日期头 */}
      <div className="bg-slate-800 px-2 py-2 text-center border-b border-slate-700 space-y-1">
        <div className="text-xs text-gray-400">{DAYS.find((d) => d.key === dayPlan.day)?.label}</div>
        {phaseStyle && (
          <div className={`text-[10px] font-medium rounded-full px-2 py-0.5 inline-block ${phaseStyle.bg} ${phaseStyle.text}`}>
            {phaseStyle.emoji} {dayPlan.carbCyclePhase === 'high-carb' ? '高碳日' :
                                dayPlan.carbCyclePhase === 'medium-carb' ? '中碳日' :
                                dayPlan.carbCyclePhase === 'low-carb' ? '低碳日' : '无碳日'}
          </div>
        )}
        {dayPlan.cookingNote && (
          <div className="text-[10px] text-gray-500">{dayPlan.cookingNote}</div>
        )}
      </div>

      {/* 四餐 */}
      {MEALS.map((meal) => (
        <div
          key={meal.key}
          className="border-b border-slate-700/50 px-2 py-2 min-h-[90px]"
        >
          <div className="text-[10px] text-gray-500 mb-1">
            {meal.emoji} {meal.label}
          </div>
          <MealCell entries={dayPlan.meals[meal.key]} />
        </div>
      ))}

      {/* 总计 */}
      <div className="bg-slate-900/50 px-2 py-2 text-center">
        <div className="text-[10px] text-gray-500 mb-1">每日总计</div>
        <div className="text-xs space-y-0.5">
          <div className="text-white font-bold">{totals?.calories ?? 0} <span className="text-[10px] text-gray-400">kcal</span></div>
          <div className="flex justify-center gap-2 text-[10px]">
            <span className="text-red-400">P{totals?.protein ?? 0}g</span>
            <span className="text-yellow-400">C{totals?.carbs ?? 0}g</span>
            <span className="text-orange-400">F{totals?.fat ?? 0}g</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MealCalendar({ plan }: Props) {
  return (
    <div className="flex overflow-x-auto border border-slate-700 rounded-xl bg-slate-900/30">
      {plan.days.map((day) => (
        <DayColumn key={day.day} dayPlan={day} />
      ))}
    </div>
  );
}
