# 🥗 AI 健康饮食规划

> 基于 DeepSeek AI 的个性化健康饮食规划工具

## 快速开始

```bash
npx @ame-1121/healthy-diet-planner
```

首次运行会自动构建并打开浏览器。

## 功能

### 🧬 AI 身体数据分析
输入身高、体重、年龄、体脂率等数据，AI 自动计算：
- BMI (身体质量指数)
- BMR (基础代谢率)
- TDEE (每日总消耗)
- 目标热量 & 宏养分配比

### 🧺 食材管理
- 添加已有食材
- AI 自动搜索食材营养信息 (每100g)
- 自动分类（蛋白质/碳水/脂肪/蔬菜等）
- 推荐最佳食用时段

### 📅 AI 一周食谱
- 横轴周一至周日，纵轴早/午/晚/加餐
- 根据身体数据 + 已有食材生成
- 标记来自库存的食材 🏠
- 支持多种饮食方式（碳循环/低碳/高蛋白/间歇断食）

## 支持

- **减脂、增肌、维持** 三种目标
- **碳循环、低碳水、高蛋白、16:8间歇断食、均衡** 五种饮食方式

## 配置

需要 [DeepSeek API Key](https://platform.deepseek.com/api_keys)，在应用界面左上角输入。

Key 存储在浏览器 LocalStorage 中，不会上传到任何服务器。

## 技术栈

- React 19 + TypeScript
- Vite
- Tailwind CSS 4
- Zustand (状态管理)
- DeepSeek API (AI 引擎)

## 开发

```bash
git clone https://github.com/ame-1121/healthy-diet-planner.git
cd healthy-diet-planner
npm install
npm run dev
```

## License

MIT
