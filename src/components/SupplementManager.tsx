import { useState } from 'react';
import { useStore } from '../store/useStore';
import type { Supplement, SupplementTiming } from '../types';

export default function SupplementManager() {
  const { supplements, addSupplement, removeSupplement } = useStore();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [dosage, setDosage] = useState('1片/天');
  const [notes, setNotes] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    const sup: Supplement = {
      id: crypto.randomUUID(),
      name: name.trim(),
      brand: brand.trim() || '通用',
      dosage: dosage.trim() || '1片/天',
      timing: 'ai_auto',  // AI全权决定最佳服用时间
      notes: notes.trim() || undefined,
    };
    addSupplement(sup);
    setName(''); setBrand(''); setDosage('1片/天'); setNotes('');
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
        <span>💊</span> 维生素 & 保健品
        <span className="text-xs text-gray-500 font-normal">{supplements.length} 项</span>
      </h2>

      {/* 提示 */}
      <div className="bg-amber-900/10 border border-amber-700/30 rounded-lg px-3 py-2 text-[10px] text-amber-300/80 leading-relaxed">
        🤖 <span className="font-medium">AI 自动管理</span>：你只需输入保健品名称，AI 顶级营养师会根据营养科学自动决定最佳服用时间（饭前/随餐/饭后）和餐次，无需手动设置。
      </div>

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
        <div className="flex gap-2">
          <input
            type="text" value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="用量，如 1片/天"
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
          />
          <input
            type="text" value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="备注（可选）"
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500"
          />
        </div>
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
          <div className="text-center text-gray-500 text-xs py-4">还没有保健品 💊<br /><span className="text-gray-600">添加后 AI 自动安排服用时间</span></div>
        )}
        {supplements.map((s) => (
          <div key={s.id} className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 flex items-center justify-between group">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium">{s.name}</span>
                {s.timing === 'ai_auto' && (
                  <span className="text-[10px] bg-purple-900/50 text-purple-400 px-1.5 py-0.5 rounded-full">🤖 AI 自动安排</span>
                )}
              </div>
              <span className="text-[10px] text-gray-500">{s.brand} · {s.dosage}</span>
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
