import { useStore } from '../store/useStore';
import { generateMealPlan } from '../ai/deepseek';
import MealCalendar from './MealCalendar';

export default function MealPlan() {
  const {
    bodyProfile, bodyAnalysis, pantry, mealPlan, setMealPlan,
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-purple-400 flex items-center gap-2">
          <span>📅</span> AI 食谱
        </h2>
        <button
          onClick={handleGenerate}
          disabled={mealPlanState === 'loading'}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-2 px-5 rounded-lg transition-all text-sm disabled:cursor-not-allowed"
        >
          {mealPlanState === 'loading' ? '⏳ AI 生成中...' : mealPlan ? '🔄 重新生成' : '✨ 生成一周食谱'}
        </button>
      </div>

      {/* 错误 */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-xs">{error}</div>
      )}

      {/* 食谱表格 */}
      {mealPlan ? (
        <div className="space-y-3">
          <div className="text-xs text-gray-500">
            生成于 {new Date(mealPlan.generatedAt).toLocaleString('zh-CN')}
            {' · '}
            <span className="text-emerald-400">🏠 = 来自已有食材</span>
          </div>
          <MealCalendar plan={mealPlan} />
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
