import { useState } from 'react';
import { useStore } from '../store/useStore';
import { searchFoodNutrition, parsePurchaseLink } from '../ai/deepseek';
import { UNIT_OPTIONS } from '../types';
import type { PantryItem } from '../types';

const CATEGORY_ICONS: Record<string, string> = {
  protein: '🥩', carb: '🍚', fat: '🧈', vegetable: '🥬',
  fruit: '🍎', dairy: '🥛', supplement: '💊', other: '📦', unknown: '❓',
};

const CATEGORY_NAMES: Record<string, string> = {
  protein: '蛋白质', carb: '碳水', fat: '脂肪', vegetable: '蔬菜',
  fruit: '水果', dairy: '乳制品', supplement: '保健品', other: '其他', unknown: '未知',
};

export default function PantryManager() {
  const {
    pantry, mealPlan, showConsumptionDays, setShowConsumptionDays,
    addPantryItem, removePantryItem, updatePantryItem,
    apiKey, setError, pantrySearchState, setPantrySearchState,
  } = useStore();

  const [input, setInput] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'link'>('text');

  // 计算消耗天数
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

  const handleParseLink = async () => {
    const link = input.trim();
    if (!link || !link.startsWith('http')) { setError('请输入有效链接（http开头）'); return; }
    if (!apiKey.trim()) { setError('请先输入 DeepSeek API Key'); return; }
    setPantrySearchState('loading');
    setError(null);
    try {
      const result = await parsePurchaseLink(apiKey, link);
      const item: PantryItem = {
        id: crypto.randomUUID(), name: result.name,
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

  const handleAnalyzeAll = async () => {
    if (!apiKey.trim()) { setError('请先输入 DeepSeek API Key'); return; }
    const unanalyzed = pantry.filter((p) => !p.nutrition || !p.brand);
    if (unanalyzed.length === 0) return;
    setPantrySearchState('loading');
    setError(null);
    try {
      const result = await searchFoodNutrition(apiKey, unanalyzed.map((p) => p.name));
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

  const adjustQuantity = (id: string, delta: number) => {
    const item = pantry.find((p) => p.id === id);
    if (!item) return;
    const newQty = Math.max(0, (item.remainingQuantity ?? 0) + delta);
    if (newQty === 0) removePantryItem(id);
    else updatePantryItem(id, { remainingQuantity: newQty, totalQuantity: Math.max(item.totalQuantity, newQty) });
  };

  const changeUnit = (id: string, unit: string) => {
    updatePantryItem(id, { unit });
  };

  const unanalyzed = pantry.filter((p) => !p.nutrition).length;
  const totalCalories = pantry.reduce((s, p) => s + (p.nutrition ? (p.nutrition.calories * p.remainingQuantity) / 100 : 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
          <span>🧺</span> 食材管理
          <span className="text-xs text-gray-500 font-normal">{pantry.length} 项</span>
        </h2>
        {/* 消耗天数开关 */}
        <button
          onClick={() => setShowConsumptionDays(!showConsumptionDays)}
          className={`text-[10px] px-2 py-1 rounded-full transition-colors ${showConsumptionDays ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/50' : 'bg-slate-800 text-gray-500 border border-slate-700'}`}
        >
          {showConsumptionDays ? '📊 消耗可见' : '👁️ 消耗隐藏'}
        </button>
      </div>

      {/* 总览条 */}
      {pantry.length > 0 && (
        <div className="text-[10px] text-gray-500 bg-slate-800/50 rounded-lg p-2 flex gap-3 flex-wrap">
          <span>总计 {pantry.length} 项</span>
          {totalCalories > 0 && <span>约 {Math.round(totalCalories).toLocaleString()} kcal</span>}
        </div>
      )}

      {/* 输入模式 */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
        <button onClick={() => setInputMode('text')} className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${inputMode === 'text' ? 'bg-slate-700 text-white' : 'text-gray-500'}`}>📝 文字输入</button>
        <button onClick={() => setInputMode('link')} className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${inputMode === 'link' ? 'bg-slate-700 text-white' : 'text-gray-500'}`}>🔗 购买链接</button>
      </div>

      {/* 输入 */}
      <div className="flex gap-2">
        <input
          type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={inputMode === 'text' ? handleKeyDown : undefined}
          placeholder={inputMode === 'text' ? '输入食材名称...' : '粘贴商品链接，AI 识别产品...'}
          className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
        />
        <button
          onClick={inputMode === 'text' ? handleAdd : handleParseLink}
          disabled={pantrySearchState === 'loading' && inputMode === 'link'}
          className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium shrink-0"
        >
          {inputMode === 'link' ? (pantrySearchState === 'loading' ? '⏳' : '🔍') : '+ 添加'}
        </button>
      </div>

      {/* AI 分析 */}
      {unanalyzed > 0 && (
        <button onClick={handleAnalyzeAll} disabled={pantrySearchState === 'loading'}
          className="w-full bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-2 rounded-lg text-sm">
          {pantrySearchState === 'loading' ? '⏳ 搜索中...' : `🔍 AI 分析 ${unanalyzed} 项食材`}
        </button>
      )}

      {/* 食材列表 */}
      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {pantry.length === 0 && (
          <div className="text-center text-gray-500 text-xs py-8">还没有食材 🛒<br /><span className="text-gray-600">粘贴电商链接可自动识别</span></div>
        )}
        {pantry.map((item) => {
          const d2c = getConsumptionDays(item.id);
          return (
            <div key={item.id} className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 flex items-start gap-3 group hover:border-slate-500">
              <div className="w-14 h-14 rounded-lg bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-2xl">
                {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : CATEGORY_ICONS[item.category]}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-medium truncate block">{item.name}</span>
                    {item.brand && <span className="text-[10px] text-amber-400/80 font-medium">{item.brand}</span>}
                  </div>
                  <button onClick={() => removePantryItem(item.id)}
                    className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs shrink-0">✕</button>
                </div>

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

                {/* 数量管理 + 单位选择 */}
                <div className="flex items-center gap-2 mt-1">
                  <button onClick={() => adjustQuantity(item.id, -1)} className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-xs flex items-center justify-center">−</button>
                  <span className="text-xs font-mono text-white min-w-[30px] text-center">{item.remainingQuantity ?? item.totalQuantity}</span>
                  <button onClick={() => adjustQuantity(item.id, 1)} className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-xs flex items-center justify-center">+</button>
                  {/* 单位下拉选择 */}
                  <select
                    value={item.unit}
                    onChange={(e) => changeUnit(item.id, e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-[10px] text-gray-300 focus:outline-none focus:border-emerald-500"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                    {!UNIT_OPTIONS.includes(item.unit as any) && <option value={item.unit}>{item.unit}</option>}
                  </select>
                </div>

                {/* 消耗天数（可开关） */}
                {showConsumptionDays && d2c !== null && d2c !== undefined && (
                  <>
                    <div className="w-full bg-slate-700 rounded-full h-1 overflow-hidden">
                      <div className={`h-full rounded-full ${d2c <= 3 ? 'bg-red-500' : d2c <= 7 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, Math.max(5, (1 - d2c / 30) * 100))}%` }} />
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${d2c <= 3 ? 'bg-red-900/40 text-red-400' : d2c <= 7 ? 'bg-amber-900/40 text-amber-400' : 'bg-emerald-900/40 text-emerald-400'}`}>
                      {d2c <= 0 ? '已用完' : `${d2c} 天消耗完`}
                    </span>
                  </>
                )}

                {(item.notes || item.purchaseLink) && (
                  <div className="text-[10px] text-gray-500 truncate">
                    {item.notes}
                    {item.purchaseLink && <a href={item.purchaseLink} target="_blank" rel="noopener" className="text-sky-400 ml-1 hover:underline">🔗</a>}
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
