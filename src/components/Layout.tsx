import BodyProfile from './BodyProfile';
import PantryManager from './PantryManager';
import SupplementManager from './SupplementManager';
import MealPlan from './MealPlan';

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* ====== 左侧面板 ====== */}
      <aside className="w-[380px] shrink-0 border-r border-slate-700 bg-slate-900/50 flex flex-col overflow-hidden">
        {/* 上半：身体数据 */}
        <div className="overflow-y-auto p-4 border-b border-slate-700" style={{ flex: '5' }}>
          <BodyProfile />
        </div>
        {/* 中间：食材管理 */}
        <div className="overflow-y-auto p-4 border-b border-slate-700" style={{ flex: '5' }}>
          <PantryManager />
        </div>
        {/* 下半：保健品 */}
        <div className="overflow-y-auto p-4" style={{ flex: '3' }}>
          <SupplementManager />
        </div>
      </aside>

      {/* ====== 右侧：食谱 ====== */}
      <main className="flex-1 overflow-auto p-4">
        <MealPlan />
      </main>
    </div>
  );
}
