import { useState } from 'react';
import { useStore } from '../store/useStore';
import { searchFoodNutrition } from '../ai/deepseek';
import type { PantryItem } from '../types';

const CATEGORY_ICONS: Record<string, string> = {
  protein: '🥩', carb: '🍚', fat: '🧈', vegetable: '🥬',
  fruit: '🍎', dairy: '🥛', other: '📦', unknown: '❓',
};

const CATEGORY_NAMES: Record<string, string> = {
  protein: '蛋白质', carb: '碳水', fat: '脂肪', vegetable: '蔬菜',
  fruit: '水果', dairy: '乳制品', other: '其他', unknown: '未知',
};

export default function PantryManager() {
  const {
    pantry, addPantryItem, removePantryItem, updatePantryItem,
    apiKey, setError, pantrySearchState, setPantrySearchState,
  } = useStore();

  const [input, setInput] = useState('');

  const handleAdd = () => {
    const name = input.trim();
    if (!name) return;
    const item: PantryItem = {
      id: crypto.randomUUID(),
      name,
      category: 'unknown',
      quantity: 1,
      unit: '份',
    };
    addPantryItem(item);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  const handleAnalyzeAll = async () => {
    if (!apiKey.trim()) { setError('请先在身体数据面板输入 DeepSeek API Key'); return; }
    const unanalyzed = pantry.filter((p) => !p.nutrition);
    if (unanalyzed.length === 0) return;
    setPantrySearchState('loading');
    setError(null);
    try {
      const names = unanalyzed.map((p) => p.name);
      const result = await searchFoodNutrition(apiKey, names);
      for (const r of result.results) {
        const match = unanalyzed.find((p) => p.name === r.name);
        if (match) {
          updatePantryItem(match.id, {
            category: r.category as PantryItem['category'],
            nutrition: r.nutrition,
            bestMealTime: r.bestMealTime as any,
            notes: r.notes,
          });
        }
      }
      setPantrySearchState('success');
    } catch (e: any) {
      setError(e.message || '食材分析失败');
      setPantrySearchState('error');
    }
  };

  const unanalyzed = pantry.filter((p) => !p.nutrition).length;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
        <span>🧺</span> 食材管理
        <span className="text-xs text-gray-500 font-normal">{pantry.length} 项</span>
      </h2>

      {/* 输入区 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入食材名称，如 鸡胸肉、西兰花..."
          className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
        />
        <button
          onClick={handleAdd}
          className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0"
        >
          + 添加
        </button>
      </div>

      {/* AI 分析按钮 */}
      {unanalyzed > 0 && (
        <button
          onClick={handleAnalyzeAll}
          disabled={pantrySearchState === 'loading'}
          className="w-full bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-2 rounded-lg transition-all text-sm"
        >
          {pantrySearchState === 'loading' ? '⏳ 搜索中...' : `🔍 AI 分析 ${unanalyzed} 项食材`}
        </button>
      )}

      {/* 食材列表 */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {pantry.length === 0 && (
          <div className="text-center text-gray-500 text-xs py-8">
            还没有食材，添加一些吧 🛒
          </div>
        )}
        {pantry.map((item) => (
          <div
            key={item.id}
            className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 flex items-start gap-3 group hover:border-slate-500 transition-colors"
          >
            <span className="text-xl shrink-0 mt-0.5">{CATEGORY_ICONS[item.category]}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate">{item.name}</span>
                <button
                  onClick={() => removePantryItem(item.id)}
                  className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs ml-2 shrink-0"
                >
                  ✕
                </button>
              </div>
              {item.nutrition ? (
                <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                  <div className="flex gap-3 flex-wrap">
                    <span>{item.nutrition.calories} kcal</span>
                    <span className="text-red-400">蛋白 {item.nutrition.protein}g</span>
                    <span className="text-yellow-400">碳水 {item.nutrition.carbs}g</span>
                    <span className="text-orange-400">脂肪 {item.nutrition.fat}g</span>
                  </div>
                  <div className="text-emerald-400/70">{CATEGORY_NAMES[item.category]}</div>
                  {item.bestMealTime && item.bestMealTime.length > 0 && (
                    <div className="text-gray-500">适合：{item.bestMealTime.map((t) => ({ breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }[t])).join('、')}</div>
                  )}
                  {item.notes && <div className="text-gray-500 italic truncate">{item.notes}</div>}
                </div>
              ) : (
                <div className="text-xs text-amber-400/70 mt-1">待分析</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
