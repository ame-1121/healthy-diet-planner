import Layout from './components/Layout';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* 顶部标题栏 */}
      <header className="bg-slate-900 border-b border-slate-700 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🥗</span>
          <div>
            <h1 className="text-base font-bold text-white">AI 健康饮食规划</h1>
            <p className="text-[11px] text-gray-500">基于 DeepSeek AI · 个性化膳食推荐</p>
          </div>
        </div>
      </header>
      {/* 主布局 */}
      <Layout />
    </div>
  );
}
