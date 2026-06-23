import { useStore } from '../store/useStore';
import { generateMealPlan } from '../ai/deepseek';
import MealCalendar from './MealCalendar';

export default function MealPlan() {
  const {
    bodyProfile, setBodyProfile, bodyAnalysis, pantry, mealPlan, setMealPlan,
    apiKey, setError, mealPlanState, setMealPlanState, error,
  } = useStore();

  const handleGenerate = async () => {
    if (!apiKey.trim()) { setError('请先在身体数据面板输入 DeepSeek API Key'); return; }
    if (!bodyAnalysis) { setError('请先点击「AI 分析身体数据」'); return; }
    setMealPlanState('loading');
    setError(null);
    try {
      const plan = await generateMealPlan(apiKey, bodyProfile, bodyAnalysis, pantry);
      setMealPlan(plan);
      setMealPlanState('success');
    } catch (e: any) {
      setError(e.message || '生成食谱失败');
      setMealPlanState('error');
    }
  };

  const isNoCook = bodyProfile.cookingPreference === 'nocook';

  return (
    <div className="space-y-4">
      {/* 标题栏 + 烹饪开关 + 生成按钮 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-purple-400 flex items-center gap-2">
          <span>📅</span> AI 食谱
        </h2>

        <div className="flex items-center gap-3">
          {/* 烹饪开关 */}
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setBodyProfile({ cookingPreference: 'cook' })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!isNoCook ? 'bg-orange-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
            >
              🍳 开火
            </button>
            <button
              onClick={() => setBodyProfile({ cookingPreference: 'nocook' })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${isNoCook ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
            >
              🛵 不开火
            </button>
          </div>

          <button
            onClick={handleGenerate}
            disabled={mealPlanState === 'loading'}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-2 px-5 rounded-lg transition-all text-sm disabled:cursor-not-allowed"
          >
            {mealPlanState === 'loading' ? '⏳ AI 生成中...' : mealPlan ? '🔄 重新生成' : '✨ 生成一周食谱'}
          </button>
        </div>
      </div>

      {/* 不开火模式提示 */}
      {isNoCook && (
        <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg px-3 py-2 text-xs text-blue-300 flex items-center gap-2">
          <span>🛵</span>
          <span>不开火模式：AI 将推荐外卖、即食、冲泡类食物，无需厨房操作</span>
        </div>
      )}

      {/* 碳循环提示 */}
      {bodyProfile.dietMethod === 'carb-cycle' && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg px-3 py-2 text-xs text-amber-300 flex flex-wrap items-center gap-3">
          <span>🔄 碳循环</span>
          <span className="bg-green-800/50 px-1.5 py-0.5 rounded">🟢 高碳日</span>
          <span className="bg-yellow-800/50 px-1.5 py-0.5 rounded">🟡 中碳日</span>
          <span className="bg-orange-800/50 px-1.5 py-0.5 rounded">🟠 低碳日</span>
          <span className="bg-red-800/50 px-1.5 py-0.5 rounded">🔴 无碳日</span>
        </div>
      )}

      {/* 错误 */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-xs">{error}</div>
      )}

      {/* 食谱表格 */}
      {mealPlan ? (
        <div className="space-y-3">
          <div className="text-xs text-gray-500 flex items-center gap-3 flex-wrap">
            <span>生成于 {new Date(mealPlan.generatedAt).toLocaleString('zh-CN')}</span>
            <span className="text-emerald-400">🏠 = 已有食材</span>
            {mealPlan.totalDaysToGoal && (
              <span className="text-amber-400 font-medium">
                🎯 预计 {mealPlan.totalDaysToGoal} 天达到目标体重
              </span>
            )}
          </div>
          <MealCalendar plan={mealPlan} />

          {/* 食材消耗预估 */}
          {mealPlan.pantryUsageSummary && mealPlan.pantryUsageSummary.length > 0 && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-gray-300">📦 食材消耗预估</h3>
              <div className="grid gap-2">
                {mealPlan.pantryUsageSummary.map((s) => (
                  <div key={s.pantryItemId} className="flex items-center justify-between text-xs bg-slate-900/50 rounded-lg px-3 py-2">
                    <span className="text-gray-300">{s.name}</span>
                    <div className="flex items-center gap-3 text-gray-400">
                      <span>每周用 {s.usedPerWeek}g</span>
                      <span className={s.daysToEmpty <= 3 ? 'text-red-400' : s.daysToEmpty <= 7 ? 'text-amber-400' : 'text-emerald-400'}>
                        {s.daysToEmpty <= 0 ? '已用完' : `剩余 ${s.daysToEmpty} 天`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500 border border-slate-700 border-dashed rounded-xl">
          <div className="text-5xl mb-4">🍽️</div>
          <div className="text-sm mb-1">还没有食谱</div>
          <div className="text-xs">请先分析身体数据，然后点击「生成一周食谱」</div>
        </div>
      )}
    </div>
  );
}
