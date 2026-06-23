import { useState } from 'react';
import { useStore } from '../store/useStore';
import { searchFoodNutrition, parsePurchaseLink } from '../ai/deepseek';
import { UNIT_OPTIONS } from '../types';
import type { PantryItem } from '../types';

const CATEGORY_ICONS: Record<string, string> = {
  protein: '🥩', carb: '🍚', fat: '🧈', vegetable: '🥬',
  fruit: '🍎', dairy: '🥛', drink: '🍵', supplement: '💊', other: '📦', unknown: '❓',
};

const CATEGORY_NAMES: Record<string, string> = {
  protein: '蛋白质', carb: '碳水', fat: '脂肪', vegetable: '蔬菜',
  fruit: '水果', dairy: '乳制品', drink: '饮品/泡水', supplement: '保健品', other: '其他', unknown: '未知',
};

const DRINK_TYPE_LABELS: Record<string, string> = {
  tea: '🍵 茶叶', coffee: '☕ 咖啡', herbal: '🌿 花草茶', supplement_drink: '🧪 冲剂', other_drink: '🥤 饮品',
};

const SUPPORTED_PLATFORMS = [
  { name: '淘宝/天猫', domains: 'taobao.com / tmall.com', icon: '🛒' },
  { name: '京东', domains: 'jd.com', icon: '🐶' },
  { name: '拼多多', domains: 'pinduoduo.com', icon: '📱' },
  { name: '抖音', domains: 'douyin.com', icon: '🎵' },
  { name: '1688', domains: '1688.com', icon: '🏭' },
  { name: '小红书', domains: 'xiaohongshu.com', icon: '📕' },
  { name: '美团/饿了么', domains: 'meituan / ele.me', icon: '🛵' },
  { name: '盒马/叮咚', domains: 'freshhema / dingdong', icon: '🥬' },
];

export default function PantryManager() {
  const {
    pantry, mealPlan, showConsumptionDays, setShowConsumptionDays,
    addPantryItem, removePantryItem, updatePantryItem,
    apiKey, setError, pantrySearchState, setPantrySearchState,
  } = useStore();

  const [input, setInput] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'link'>('text');
  const [showLinkHelp, setShowLinkHelp] = useState(false);

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
    if (!link || !link.startsWith('http')) {
      setError('请输入有效的链接（以 http/https 开头）');
      return;
    }
    if (!apiKey.trim()) { setError('请先输入 DeepSeek API Key'); return; }
    setPantrySearchState('loading');
    setError(null);
    try {
      const result = await parsePurchaseLink(apiKey, link);
      const item: PantryItem = {
        id: crypto.randomUUID(), name: result.name,
        brand: result.brand !== '未知商品' ? result.brand : undefined,
        category: (result.category as PantryItem['category']) || 'unknown',
        totalQuantity: result.estimatedQuantity,
        remainingQuantity: result.estimatedQuantity,
        unit: result.unit,
        purchaseLink: link,
        notes: result.notes,
        isDrink: result.isDrink || result.category === 'drink',
        drinkType: result.category === 'drink' ? 'other_drink' : undefined,
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
        const match = unanalyzed.find((p) => p.name === r.name || r.name.includes(p.name) || p.name.includes(r.name));
        if (match) {
          updatePantryItem(match.id, {
            category: r.category as PantryItem['category'],
            nutrition: r.nutrition,
            brand: r.brand !== '通用' && r.brand ? r.brand : match.brand,
            imageUrl: r.imageUrl || undefined,
            bestMealTime: r.bestMealTime as any,
            notes: r.notes || match.notes,
            isDrink: r.isDrink || r.category === 'drink',
            drinkType: (r.drinkType as PantryItem['drinkType']) || undefined,
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

  const togglePriority = (id: string) => {
    const item = pantry.find((p) => p.id === id);
    if (!item) return;
    updatePantryItem(id, { priority: !item.priority });
  };

  const unanalyzed = pantry.filter((p) => !p.nutrition).length;
  const totalCalories = pantry.reduce((s, p) => s + (p.nutrition ? (p.nutrition.calories * (p.remainingQuantity ?? 0)) / 100 : 0), 0);
  const priorityCount = pantry.filter((p) => p.priority).length;
  const drinkCount = pantry.filter((p) => p.isDrink || p.category === 'drink').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
          <span>🧺</span> 食材管理
          <span className="text-xs text-gray-500 font-normal">{pantry.length} 项</span>
          {priorityCount > 0 && <span className="text-xs text-amber-400 font-medium">⚡{priorityCount}</span>}
          {drinkCount > 0 && <span className="text-xs text-blue-400 font-medium">🍵{drinkCount}</span>}
        </h2>
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
          {priorityCount > 0 && <span className="text-amber-400">⚡ {priorityCount} 项优先消耗</span>}
          {drinkCount > 0 && <span className="text-blue-400">🍵 {drinkCount} 项饮品</span>}
        </div>
      )}

      {/* 输入模式 */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
        <button onClick={() => setInputMode('text')} className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${inputMode === 'text' ? 'bg-slate-700 text-white' : 'text-gray-500'}`}>📝 文字输入</button>
        <button onClick={() => setInputMode('link')} className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${inputMode === 'link' ? 'bg-slate-700 text-white' : 'text-gray-500'}`}>🔗 购物链接</button>
      </div>

      {/* 输入 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={inputMode === 'text' ? handleKeyDown : undefined}
            placeholder={inputMode === 'text' ? '输入食材/饮品名称…' : '粘贴淘宝/京东/拼多多/抖音等商品链接…'}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
          />
          {inputMode === 'link' && (
            <button
              onClick={() => setShowLinkHelp(!showLinkHelp)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-emerald-400 text-xs"
              title="支持的链接类型"
            >❓</button>
          )}
        </div>
        <button
          onClick={inputMode === 'text' ? handleAdd : handleParseLink}
          disabled={pantrySearchState === 'loading' && inputMode === 'link'}
          className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium shrink-0"
        >
          {inputMode === 'link' ? (pantrySearchState === 'loading' ? '⏳' : '🔍 识别') : '+ 添加'}
        </button>
      </div>

      {/* 链接帮助面板 */}
      {showLinkHelp && inputMode === 'link' && (
        <div className="bg-slate-800/80 border border-slate-600 rounded-lg p-3 space-y-2">
          <p className="text-xs text-gray-400 font-medium">🔗 支持识别的平台和链接：</p>
          <div className="grid grid-cols-2 gap-1">
            {SUPPORTED_PLATFORMS.map((p) => (
              <div key={p.name} className="text-[10px] text-gray-400 flex items-center gap-1">
                <span>{p.icon}</span>
                <span className="text-gray-300">{p.name}</span>
                <span className="text-gray-600">{p.domains}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-600">直接粘贴链接或分享口令即可，AI 自动提取商品信息</p>
        </div>
      )}

      {/* AI 分析 */}
      {unanalyzed > 0 && (
        <button onClick={handleAnalyzeAll} disabled={pantrySearchState === 'loading'}
          className="w-full bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium py-2 rounded-lg text-sm">
          {pantrySearchState === 'loading' ? '⏳ 搜索中...' : `🔍 AI 分析 ${unanalyzed} 项食材（含营养+饮品识别）`}
        </button>
      )}

      {/* 食材列表 */}
      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {pantry.length === 0 && (
          <div className="text-center text-gray-500 text-xs py-8">还没有食材 🛒<br /><span className="text-gray-600">粘贴电商链接可自动识别 | 支持茶叶/咖啡等饮品</span></div>
        )}
        {pantry.map((item) => {
          const d2c = getConsumptionDays(item.id);
          const isDrink = item.isDrink || item.category === 'drink';
          return (
            <div key={item.id} className={`bg-slate-800/80 border rounded-lg p-3 flex items-start gap-3 group transition-all ${item.priority ? 'border-amber-500/60 shadow shadow-amber-900/20' : 'border-slate-700 hover:border-slate-500'}`}>
              <div className="w-14 h-14 rounded-lg bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-2xl relative">
                {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : CATEGORY_ICONS[item.category] || '📦'}
                {item.priority && <span className="absolute -top-1 -right-1 text-xs" title="优先消耗">⚡</span>}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{item.name}</span>
                      {item.priority && <span className="text-[10px] bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded-full shrink-0">⚡ 优先消耗</span>}
                      {isDrink && item.drinkType && DRINK_TYPE_LABELS[item.drinkType] && (
                        <span className="text-[10px] bg-blue-900/50 text-blue-400 px-1.5 py-0.5 rounded-full shrink-0">{DRINK_TYPE_LABELS[item.drinkType]}</span>
                      )}
                    </div>
                    {item.brand && <span className="text-[10px] text-amber-400/80 font-medium">{item.brand}</span>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* 优先消耗开关 */}
                    <button
                      onClick={() => togglePriority(item.id)}
                      className={`text-xs px-1.5 py-0.5 rounded transition-all opacity-0 group-hover:opacity-100 ${item.priority ? 'bg-amber-700/50 text-amber-400 border border-amber-600/50 opacity-100' : 'text-gray-500 hover:text-amber-400 hover:bg-slate-700'}`}
                      title={item.priority ? '取消优先消耗' : '设为优先消耗'}
                    >⚡</button>
                    <button onClick={() => removePantryItem(item.id)}
                      className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs">✕</button>
                  </div>
                </div>

                {item.nutrition ? (
                  <div className="text-[10px] text-gray-400 flex gap-2 flex-wrap">
                    <span>{item.nutrition.calories}kcal/100g</span>
                    <span className="text-red-400">P{item.nutrition.protein}g</span>
                    <span className="text-yellow-400">C{item.nutrition.carbs}g</span>
                    <span className="text-orange-400">F{item.nutrition.fat}g</span>
                    {item.nutrition.caffeine !== undefined && item.nutrition.caffeine > 0 && (
                      <span className="text-purple-400">☕{item.nutrition.caffeine}mg</span>
                    )}
                    <span className="text-emerald-400/60">{CATEGORY_NAMES[item.category] || item.category}</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-amber-400/70">待 AI 分析</div>
                )}

                {/* 数量管理 + 单位选择 */}
                <div className="flex items-center gap-2 mt-1">
                  <button onClick={() => adjustQuantity(item.id, -1)} className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-xs flex items-center justify-center">−</button>
                  <span className="text-xs font-mono text-white min-w-[30px] text-center">{item.remainingQuantity ?? item.totalQuantity}</span>
                  <button onClick={() => adjustQuantity(item.id, 1)} className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-xs flex items-center justify-center">+</button>
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

                {/* 消耗天数 */}
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
