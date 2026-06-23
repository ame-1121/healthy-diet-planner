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
          <label className="block text-xs text-gray-400 mb-1">体重 (kg)</label>
          <input type="number" value={bodyProfile.weight} onChange={(e) => setBodyProfile({ weight: Number(e.target.value) })}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500" />
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
      </div>

      {/* 性别 & 目标 */}
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

      {/* 饮食方式 */}
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
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900 rounded-lg p-2 text-center">
              <div className="text-gray-400">BMI</div>
              <div className="text-white font-bold text-lg">{bodyAnalysis.bmi}</div>
            </div>
            <div className="bg-slate-900 rounded-lg p-2 text-center">
              <div className="text-gray-400">BMR</div>
              <div className="text-white font-bold text-lg">{bodyAnalysis.bmr}<span className="text-xs text-gray-400"> kcal</span></div>
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
          <div className="text-xs text-gray-300 grid grid-cols-3 gap-2 bg-slate-900 rounded-lg p-3">
            <div className="text-center"><span className="text-red-400 font-bold">{bodyAnalysis.macroSplit.protein}g</span><br/><span className="text-gray-500">蛋白质</span></div>
            <div className="text-center"><span className="text-yellow-400 font-bold">{bodyAnalysis.macroSplit.carbs}g</span><br/><span className="text-gray-500">碳水</span></div>
            <div className="text-center"><span className="text-orange-400 font-bold">{bodyAnalysis.macroSplit.fat}g</span><br/><span className="text-gray-500">脂肪</span></div>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">{bodyAnalysis.summary}</p>
        </div>
      )}
    </div>
  );
}
