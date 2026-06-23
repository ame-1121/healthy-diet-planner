import { useStore } from '../store/useStore';
import { analyzeBodyProfile } from '../ai/deepseek';

export default function BodyProfile() {
  const {
    bodyProfile, setBodyProfile,
    bodyAnalysis, setBodyAnalysis,
    apiKey, setApiKey,
    analysisState, setAnalysisState,
    error, setError,
  } = useStore();

  const handleAnalyze = async () => {
    if (!apiKey.trim()) {
      setError('请先输入 DeepSeek API Key');
      return;
    }
    setAnalysisState('loading');
    setError(null);
    try {
      const result = await analyzeBodyProfile(apiKey, bodyProfile);
      setBodyAnalysis(result);
      setAnalysisState('success');
    } catch (e: any) {
      setError(e.message || 'AI 分析失败');
      setAnalysisState('error');
    }
  };

  const diets = [
    { value: 'balanced', label: '均衡饮食' },
    { value: 'carb-cycle', label: '碳循环' },
    { value: 'low-carb', label: '低碳水' },
    { value: 'high-protein', label: '高蛋白' },
    { value: 'if-16-8', label: '16:8 间歇断食' },
  ] as const;

  const goals = [
    { value: 'cut', label: '减脂' },
    { value: 'bulk', label: '增肌' },
    { value: 'maintain', label: '维持' },
  ] as const;

  // 体重变化进度
  const weightDiff = bodyProfile.targetWeight - bodyProfile.weight;
  const weightDir = weightDiff > 0 ? '增重' : weightDiff < 0 ? '减重' : '维持';
  const absWeightDiff = Math.abs(weightDiff).toFixed(1);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-sky-400 flex items-center gap-2">
        <span>🧬</span> 身体数据
      </h2>

      {/* API Key */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">DeepSeek API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-xxxxxxxxxxxxxxxx"
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500 transition-colors"
        />
      </div>

      {/* 基本数据 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">身高 (cm)</label>
          <input type="number" value={bodyProfile.height} onChange={(e) => setBodyProfile({ height: Number(e.target.value) })}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">当前体重 (kg)</label>
          <input type="number" value={bodyProfile.weight} onChange={(e) => setBodyProfile({ weight: Number(e.target.value) })}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">目标体重 (kg)</label>
          <input type="number" value={bodyProfile.targetWeight} onChange={(e) => setBodyProfile({ targetWeight: Number(e.target.value) })}
            className="w-full bg-slate-800 border border-amber-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400 transition-colors" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">年龄</label>
          <input type="number" value={bodyProfile.age} onChange={(e) => setBodyProfile({ age: Number(e.target.value) })}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">体脂率 (%)</label>
          <input type="number" value={bodyProfile.bodyFat} onChange={(e) => setBodyProfile({ bodyFat: Number(e.target.value) })}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">烹饪条件</label>
          <select value={bodyProfile.cookingPreference} onChange={(e) => setBodyProfile({ cookingPreference: e.target.value as 'cook' | 'nocook' })}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500">
            <option value="cook">🍳 开火</option>
            <option value="nocook">🛵 不开火</option>
          </select>
        </div>
      </div>

      {/* 目标体重进度条 */}
      {weightDiff !== 0 && (
        <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>当前 {bodyProfile.weight}kg</span>
            <span>目标 {bodyProfile.targetWeight}kg（{weightDir}{absWeightDiff}kg）</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.abs(bodyProfile.weight - bodyProfile.targetWeight) / Math.max(1, bodyProfile.targetWeight) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* 性别 & 目标 & 饮食方式 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">性别</label>
          <select value={bodyProfile.gender} onChange={(e) => setBodyProfile({ gender: e.target.value as 'male' | 'female' })}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500">
            <option value="male">男</option>
            <option value="female">女</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">目标</label>
          <select value={bodyProfile.goal} onChange={(e) => setBodyProfile({ goal: e.target.value as any })}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500">
            {goals.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">饮食方式</label>
        <select value={bodyProfile.dietMethod} onChange={(e) => setBodyProfile({ dietMethod: e.target.value as any })}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500">
          {diets.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>

      {/* AI 分析按钮 */}
      <button
        onClick={handleAnalyze}
        disabled={analysisState === 'loading'}
        className="w-full bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all text-sm disabled:cursor-not-allowed"
      >
        {analysisState === 'loading' ? '⏳ AI 分析中...' : '🤖 AI 分析身体数据'}
      </button>

      {/* 错误 */}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-xs">{error}</div>
      )}

      {/* 分析结果 */}
      {bodyAnalysis && (
        <div className="bg-slate-800/80 border border-slate-600 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-green-400">📊 AI 分析结果</h3>

          {/* BMI + BMR + TDEE + 目标热量 */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900 rounded-lg p-2 text-center">
              <div className="text-gray-400">BMI</div>
              <div className="text-white font-bold text-lg">{bodyAnalysis.bmi}</div>
            </div>
            <div className="bg-purple-900/40 rounded-lg p-2 text-center border border-purple-700">
              <div className="text-purple-300">🔥 基础代谢 BMR</div>
              <div className="text-purple-300 font-bold text-lg">{bodyAnalysis.bmr}<span className="text-xs text-purple-400/70"> kcal</span></div>
            </div>
            <div className="bg-slate-900 rounded-lg p-2 text-center">
              <div className="text-gray-400">TDEE</div>
              <div className="text-white font-bold text-lg">{bodyAnalysis.tdee}<span className="text-xs text-gray-400"> kcal</span></div>
            </div>
            <div className="bg-sky-900/40 rounded-lg p-2 text-center border border-sky-700">
              <div className="text-sky-300">目标热量</div>
              <div className="text-sky-400 font-bold text-lg">{bodyAnalysis.targetCalories}<span className="text-xs"> kcal</span></div>
            </div>
          </div>

          {/* 宏营养分配 */}
          <div className="text-xs text-gray-300 grid grid-cols-3 gap-2 bg-slate-900 rounded-lg p-3">
            <div className="text-center"><span className="text-red-400 font-bold">{bodyAnalysis.macroSplit.protein}g</span><br/><span className="text-gray-500">蛋白质</span></div>
            <div className="text-center"><span className="text-yellow-400 font-bold">{bodyAnalysis.macroSplit.carbs}g</span><br/><span className="text-gray-500">碳水</span></div>
            <div className="text-center"><span className="text-orange-400 font-bold">{bodyAnalysis.macroSplit.fat}g</span><br/><span className="text-gray-500">脂肪</span></div>
          </div>

          {/* 体重目标预测 */}
          {bodyProfile.targetWeight !== bodyProfile.weight && (
            <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-300 font-medium">⏱️ 目标体重预测</span>
                <span className="text-gray-500">{bodyProfile.weight} → {bodyProfile.targetWeight}kg</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900 rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-400">每周{weightDir}</div>
                  <div className="text-white font-bold">{Math.abs(bodyAnalysis.weeklyWeightChange ?? 0.5).toFixed(1)} kg</div>
                </div>
                <div className="bg-emerald-900/40 rounded-lg p-2 text-center border border-emerald-700/50">
                  <div className="text-xs text-emerald-300">预计到达目标</div>
                  <div className="text-emerald-400 font-bold text-lg">
                    {bodyAnalysis.estimatedDaysToGoal}
                    <span className="text-xs text-emerald-400/70"> 天</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 leading-relaxed">{bodyAnalysis.summary}</p>
        </div>
      )}
    </div>
  );
}
