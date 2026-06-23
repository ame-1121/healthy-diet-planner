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
            {entry.fromPantry && <span className="text-emerald-400 text-[10px]" title="来自已有食材">🏠</span>}
            <span className="text-white font-medium">{entry.name}</span>
          </div>
          <div className="flex gap-2 text-[10px] text-gray-400">
            <span>{entry.amount}</span>
            <span>{entry.calories}kcal</span>
            <span className="text-red-400/70">P{entry.protein}</span>
            <span className="text-yellow-400/70">C{entry.carbs}</span>
            <span className="text-orange-400/70">F{entry.fat}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DayColumn({ dayPlan }: { dayPlan: DayMealPlan }) {
  const totals = dayPlan.dailyTotals;
  return (
    <div className="flex-1 min-w-[150px] border-r border-slate-700 last:border-r-0">
      {/* 日期头 */}
      <div className="bg-slate-800 px-2 py-2 text-center border-b border-slate-700">
        <div className="text-xs text-gray-400">{DAYS.find((d) => d.key === dayPlan.day)?.label}</div>
        <div className="text-[10px] text-gray-500">{dayPlan.day}</div>
      </div>
      {/* 四餐 */}
      {MEALS.map((meal) => (
        <div
          key={meal.key}
          className="border-b border-slate-700/50 px-2 py-2 min-h-[80px]"
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
