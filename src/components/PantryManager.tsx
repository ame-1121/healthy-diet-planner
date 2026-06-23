import { useState } from 'react';
import { useStore } from '../store/useStore';
import { searchFoodNutrition, parsePurchaseLink } from '../ai/deepseek';
import type { PantryItem } from '../types';

const CATEGORY_ICONS: Record<string, string> = {
  protein: '🥩', carb: '🍚', fat: '🧈', vegetable: '🥬',
  fruit: '🍎', dairy: '🥛', other: '📦', unknown: '❓',
};

const CATEGORY_NAMES: Record<string, string> = {
  protein: '蛋白质', carb: '碳水', fat: '脂肪', vegetable: '蔬菜',
  fruit: '水果', dairy: '乳制品', other: '其他', unknown: '未知',
};

const CATEGORY_OPTIONS = [
  { value: 'protein', label: '🥩 蛋白质' },
  { value: 'carb', label: '🍚 碳水' },
  { value: 'fat', label: '🧈 脂肪' },
  { value: 'vegetable', label: '🥬 蔬菜' },
  { value: 'fruit', label: '🍎 水果' },
  { value: 'dairy', label: '🥛 乳制品' },
  { value: 'other', label: '📦 其他' },
] as const;

export default function PantryManager() {
  const {
    pantry, mealPlan, addPantryItem, removePantryItem, updatePantryItem,
    apiKey, setError, pantrySearchState, setPantrySearchState,
  } = useStore();

  const [input, setInput] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'link'>('text');
  const [editingId, setEditingId] = useState<string | null>(null);

  // 计算消耗天数（从食谱中提取）
  const getConsumptionDays = (itemId: string) => {
    if (!mealPlan?.pantryUsageSummary) return null;
    const s = mealPlan.pantryUsageSummary.find((p) => p.pantryItemId === itemId);
    return s?.daysToEmpty ?? null;
  };

  const handleAdd = () => {
    const value = input.trim();
    if (!value) return;
    const item: PantryItem = {
      id: crypto.randomUUID(),
      name: value,
      category: 'unknown',
      totalQuantity: 1,
      remainingQuantity: 1,
      unit: '份',
    };
    addPantryItem(item);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  // 粘贴购买链接 → AI 解析
  const handleParseLink = async () => {
    const link = input.trim();
    if (!link || !link.startsWith('http')) {
      setError('请输入有效的购买链接（以 http/https 开头）');
      return;
    }
    if (!apiKey.trim()) { setError('请先在身体数据面板输入 DeepSeek API Key'); return; }
    setPantrySearchState('loading');
    setError(null);
    try {
      const result = await parsePurchaseLink(apiKey, link);
      const item: PantryItem = {
        id: crypto.randomUUID(),
        name: result.name,
        brand: result.brand !== '未知商品' ? result.brand : undefined,
        category: 'unknown',
        totalQuantity: result.estimatedQuantity,
        remainingQuantity: result.estimatedQuantity,
        unit: result.unit,
        purchaseLink: link,
        notes: result.notes,
      };
      addPantryItem(item);
      setInput('');
      setPantrySearchState('success');
    } catch (e: any) {
      setError(e.message || '链接解析失败');
      setPantrySearchState('error');
    }
  };

  // AI 分析所有未分析食材
  const handleAnalyzeAll = async () => {
    if (!apiKey.trim()) { setError('请先在身体数据面板输入 DeepSeek API Key'); return; }
    const unanalyzed = pantry.filter((p) => !p.nutrition || !p.brand);
    if (unanalyzed.length === 0) return;
    setPantrySearchState('loading');
    setError(null);
    try {
      const names = unanalyzed.map((p) => p.name);
      const result = await searchFoodNutrition(apiKey, names);
      for (const r of result.results) {
        const match = unanalyzed.find((p) => p.name === r.name || r.name.includes(p.name));
        if (match) {
          updatePantryItem(match.id, {
            category: r.category as PantryItem['category'],
            nutrition: r.nutrition,
            brand: r.brand !== '通用' && r.brand ? r.brand : match.brand,
            imageUrl: r.imageUrl || undefined,
            bestMealTime: r.bestMealTime as any,
            notes: r.notes || match.notes,
          });
        }
      }
      setPantrySearchState('success');
    } catch (e: any) {
      setError(e.message || '食材分析失败');
      setPantrySearchState('error');
    }
  };

  // 调整数量
  const adjustQuantity = (id: string, delta: number) => {
    const item = pantry.find((p) => p.id === id);
    if (!item) return;
    const newQty = Math.max(0, (item.remainingQuantity ?? 0) + delta);
    if (newQty === 0) {
      removePantryItem(id);
    } else {
      updatePantryItem(id, { remainingQuantity: newQty, totalQuantity: Math.max(item.totalQuantity, newQty) });
    }
  };

  const unanalyzed = pantry.filter((p) => !p.nutrition).length;

  // 总数统计
  const totalItems = pantry.length;
  const totalCalories = pantry.reduce((s, p) => s + (p.nutrition ? (p.nutrition.calories * p.remainingQuantity) / 100 : 0), 0);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
        <span>🧺</span> 食材管理
        <span className="text-xs text-gray-500 font-normal">{totalItems} 项</span>
      </h2>

      {/* 总览条 */}
      {pantry.length > 0 && (
        <div className="text-[10px] text-gray-500 bg-slate-800/50 rounded-lg p-2 flex gap-3 flex-wrap">
          <span>总计 {totalItems} 项</span>
          {totalCalories > 0 && <span>约 {Math.round(totalCalories).toLocaleString()} kcal</span>}
          {mealPlan && <span className="text-emerald-400/70">食谱已就绪 · 消耗天数见下</span>}
        </div>
      )}

      {/* 输入模式切换 */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
        <button
          onClick={() => setInputMode('text')}
          className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${inputMode === 'text' ? 'bg-slate-700 text-white' : 'text-gray-500'}`}
        >
          📝 文字输入
        </button>
        <button
          onClick={() => setInputMode('link')}
          className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${inputMode === 'link' ? 'bg-slate-700 text-white' : 'text-gray-500'}`}
        >
          🔗 购买链接
        </button>
      </div>

      {/* 输入区 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={inputMode === 'text' ? handleKeyDown : undefined}
          placeholder={
            inputMode === 'text'
              ? '输入食材名称，如 伊利纯牛奶...'
              : '粘贴商品链接，AI 自动识别产品...'
          }
          className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
        />
        <button
          onClick={inputMode === 'text' ? handleAdd : handleParseLink}
          disabled={pantrySearchState === 'loading' && inputMode === 'link'}
          className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0"
        >
          {inputMode === 'link'
            ? (pantrySearchState === 'loading' ? '⏳' : '🔍 解析')
            : '+ 添加'}
        </button>
      </div>

      {/* AI 分析按钮 */}
      {unanalyzed > 0 && (
        <button
          onClick={handleAnalyzeAll}
          disabled={pantrySearchState === 'loading'}
          className="w-full bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-2 rounded-lg transition-all text-sm"
        >
          {pantrySearchState === 'loading' ? '⏳ 搜索中...' : `🔍 AI 分析 ${unanalyzed} 项食材（品牌+营养）`}
        </button>
      )}

      {/* 食材列表 */}
      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {pantry.length === 0 && (
          <div className="text-center text-gray-500 text-xs py-8">
            还没有食材，添加一些吧 🛒<br />
            <span className="text-gray-600">粘贴电商链接也可自动识别产品</span>
          </div>
        )}
        {pantry.map((item) => {
          const d2c = getConsumptionDays(item.id);
          return (
            <div
              key={item.id}
              className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 flex items-start gap-3 group hover:border-slate-500 transition-colors"
            >
              {/* 产品图片 / 占位 */}
              <div className="w-14 h-14 rounded-lg bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-2xl">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  CATEGORY_ICONS[item.category]
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                {/* 名称 + 品牌 + 删除 */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-medium truncate block">{item.name}</span>
                    {item.brand && (
                      <span className="text-[10px] text-amber-400/80 font-medium">{item.brand}</span>
                    )}
                  </div>
                  <button
                    onClick={() => removePantryItem(item.id)}
                    className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs shrink-0"
                  >
                    ✕
                  </button>
                </div>

                {/* 营养数据 */}
                {item.nutrition ? (
                  <div className="text-[10px] text-gray-400 flex gap-2 flex-wrap">
                    <span>{item.nutrition.calories}kcal/100g</span>
                    <span className="text-red-400">P{item.nutrition.protein}g</span>
                    <span className="text-yellow-400">C{item.nutrition.carbs}g</span>
                    <span className="text-orange-400">F{item.nutrition.fat}g</span>
                    <span className="text-emerald-400/60">{CATEGORY_NAMES[item.category]}</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-amber-400/70">待 AI 分析</div>
                )}

                {/* 数量管理 */}
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => adjustQuantity(item.id, -1)}
                    className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-xs flex items-center justify-center transition-colors"
                  >
                    −
                  </button>
                  <span className="text-xs font-mono text-white min-w-[40px] text-center">
                    {item.remainingQuantity ?? item.totalQuantity}
                  </span>
                  <button
                    onClick={() => adjustQuantity(item.id, 1)}
                    className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-xs flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                  <span className="text-[10px] text-gray-500">{item.unit}</span>

                  {/* 消耗天数 */}
                  {d2c !== null && d2c !== undefined && (
                    <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full ${d2c <= 3 ? 'bg-red-900/40 text-red-400' : d2c <= 7 ? 'bg-amber-900/40 text-amber-400' : 'bg-emerald-900/40 text-emerald-400'}`}>
                      {d2c <= 0 ? '已用完' : `${d2c} 天消耗完`}
                    </span>
                  )}
                </div>

                {/* 食谱消耗进度条 */}
                {d2c !== null && d2c !== undefined && d2c > 0 && (
                  <div className="w-full bg-slate-700 rounded-full h-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${d2c <= 3 ? 'bg-red-500' : d2c <= 7 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, (1 - d2c / 30) * 100)}%` }}
                    />
                  </div>
                )}

                {/* 备注 + 购买链接 */}
                {(item.notes || item.purchaseLink) && (
                  <div className="text-[10px] text-gray-500 truncate">
                    {item.notes}
                    {item.purchaseLink && (
                      <a href={item.purchaseLink} target="_blank" rel="noopener noreferrer" className="text-sky-400 ml-1 hover:underline">🔗 来源</a>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
