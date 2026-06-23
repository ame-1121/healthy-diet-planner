import { useState } from 'react';
import { useStore } from '../store/useStore';
import type { Supplement, SupplementTiming } from '../types';

const TIMING_LABELS: Record<SupplementTiming, string> = {
  before_meal: '🔺 饭前',
  with_meal: '🍽️ 随餐',
  after_meal: '🔻 饭后',
};

const MEAL_OPTIONS = [
  { value: 'breakfast', label: '🌅 早餐' },
  { value: 'lunch', label: '☀️ 午餐' },
  { value: 'dinner', label: '🌙 晚餐' },
  { value: 'snack', label: '🍪 加餐' },
] as const;

export default function SupplementManager() {
  const { supplements, addSupplement, removeSupplement, updateSupplement } = useStore();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [dosage, setDosage] = useState('1片/天');
  const [timing, setTiming] = useState<SupplementTiming>('with_meal');
  const [bestMeal, setBestMeal] = useState<string>('');
  const [notes, setNotes] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    const sup: Supplement = {
      id: crypto.randomUUID(),
      name: name.trim(),
      brand: brand.trim() || '通用',
      dosage: dosage.trim() || '1片/天',
      timing,
      bestMeal: bestMeal || undefined,
      notes: notes.trim() || undefined,
    };
    addSupplement(sup);
    setName(''); setBrand(''); setDosage('1片/天');
    setTiming('with_meal'); setBestMeal(''); setNotes('');
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
        <span>💊</span> 维生素 & 保健品
        <span className="text-xs text-gray-500 font-normal">{supplements.length} 项</span>
      </h2>

      {/* 添加表单 */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text" value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="名称，如 维生素C片"
            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
          />
          <input
            type="text" value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="品牌，如 汤臣倍健"
            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="text" value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="用量，如 1片/天"
            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
          />
          <select
            value={timing}
            onChange={(e) => setTiming(e.target.value as SupplementTiming)}
            className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500"
          >
            <option value="before_meal">🔺 饭前</option>
            <option value="with_meal">🍽️ 随餐</option>
            <option value="after_meal">🔻 饭后</option>
          </select>
          <select
            value={bestMeal}
            onChange={(e) => setBestMeal(e.target.value)}
            className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500"
          >
            <option value="">不限餐次</option>
            {MEAL_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <input
          type="text" value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="备注（可选）"
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
        />
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="w-full bg-amber-700 hover:bg-amber-600 disabled:bg-gray-700 text-white font-medium py-1.5 rounded-lg text-xs"
        >
          + 添加保健品
        </button>
      </div>

      {/* 保健品列表 */}
      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
        {supplements.length === 0 && (
          <div className="text-center text-gray-500 text-xs py-4">还没有保健品 💊</div>
        )}
        {supplements.map((s) => (
          <div key={s.id} className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 flex items-center justify-between group">
            <div className="min-w-0">
              <span className="text-xs font-medium block">{s.name}</span>
              <span className="text-[10px] text-gray-500">{s.brand} · {s.dosage} · {TIMING_LABELS[s.timing]}{s.bestMeal ? ` · ${MEAL_OPTIONS.find(m=>m.value===s.bestMeal)?.label}` : ''}</span>
              {s.notes && <span className="text-[10px] text-gray-600 block">{s.notes}</span>}
            </div>
            <button onClick={() => removeSupplement(s.id)}
              className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs shrink-0 ml-2">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
