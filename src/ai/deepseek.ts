import type { BodyProfile, BodyAnalysis, PantryItem, Supplement, TakeoutDish, WeeklyMealPlan } from '../types';

const API_BASE = 'https://api.deepseek.com';

async function callDeepSeek(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 8192
): Promise<string> {
  const res = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) { const err = await res.text(); throw new Error(`DeepSeek API error (${res.status}): ${err}`); }
  const data = await res.json();
  return data.choices[0].message.content;
}

function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  const brace = text.indexOf('{');
  if (brace >= 0) {
    let depth = 0;
    for (let i = brace; i < text.length; i++) {
      if (text[i] === '{') depth++;
      if (text[i] === '}') depth--;
      if (depth === 0) return text.slice(brace, i + 1);
    }
  }
  return text;
}

// ========== 分析身体数据 ==========
export async function analyzeBodyProfile(apiKey: string, profile: BodyProfile): Promise<BodyAnalysis> {
  const systemPrompt = `你是一位专业的营养学与运动科学AI。根据用户的身体数据，计算并返回JSON格式的分析结果。
计算规则：
- bmi: 体重(kg)/(身高(m))²，保留1位小数
- bmr: Mifflin-St Jeor公式(男:10×体重+6.25×身高-5×年龄+5/女:10×体重+6.25×身高-5×年龄-161)
- tdee: BMR×1.375(轻度活动)
- targetCalories: 减脂=TDEE-400, 增肌=TDEE+400, 维持=TDEE
- macroSplit: 减脂(蛋白2.2g/kg,脂肪≥0.8g/kg,碳水补剩余)/增肌(蛋白1.8g/kg,脂肪≥1g/kg,碳水补剩余)/维持(蛋白1.6g/kg,脂肪≥0.8g/kg,碳水补剩余)
- estimatedDaysToGoal: |目标体重-当前体重|÷每周速度×7 (健康速度每周0.5-1kg)
- weeklyWeightChange: 每周体重变化kg(正=增重,负=减重,保留1位小数)
- summary: 3-4句中文化
返回严格合法JSON，不要其他文字。`;

  const diff = profile.targetWeight - profile.weight;
  const weightDir = diff > 0 ? '增重' : diff < 0 ? '减重' : '维持';

  const userMsg = `
性别：${profile.gender === 'male' ? '男' : '女'} | 年龄：${profile.age}岁 | 身高：${profile.height}cm
当前体重：${profile.weight}kg | 目标体重：${profile.targetWeight}kg(需${weightDir}${Math.abs(diff).toFixed(1)}kg)
体脂率：${profile.bodyFat}% | 目标：${profile.goal === 'cut' ? '减脂' : profile.goal === 'bulk' ? '增肌' : '维持'} | 饮食方式：${profile.dietMethod}
`;

  const response = await callDeepSeek(apiKey, systemPrompt, userMsg);
  return JSON.parse(extractJSON(response)) as BodyAnalysis;
}

// ========== 搜索食材营养信息 ==========
export async function searchFoodNutrition(apiKey: string, foodNames: string[]): Promise<{
  results: Array<{ name: string; brand: string; category: string; nutrition: { calories: number; protein: number; carbs: number; fat: number; fiber: number }; bestMealTime: string[]; imageUrl: string; notes: string }>;
}> {
  const systemPrompt = `你是食品营养专家。分析食材/产品营养。返回JSON：{"results":[{"name":"产品名","brand":"品牌（无法识别填通用）","category":"protein|carb|fat|vegetable|fruit|dairy|other","nutrition":{"calories":每100g热量,"protein":每100g蛋白g,"carbs":每100g碳水g,"fat":每100g脂肪g,"fiber":每100g纤维g},"bestMealTime":["breakfast"|"lunch"|"dinner"|"snack"],"imageUrl":"","notes":"简短说明"}]}`;
  const response = await callDeepSeek(apiKey, systemPrompt, `分析：${foodNames.join('、')}`);
  return JSON.parse(extractJSON(response));
}

// ========== 解析购买链接 ==========
export async function parsePurchaseLink(apiKey: string, link: string): Promise<{ name: string; brand: string; estimatedQuantity: number; unit: string; notes: string }> {
  const systemPrompt = `你是电商产品分析专家。从链接识别产品。返回JSON：{"name":"产品名","brand":"品牌","estimatedQuantity":数量,"unit":"g/个/袋/瓶/盒/包","notes":"说明"}。无法识别时name填"未知商品"。`;
  const response = await callDeepSeek(apiKey, systemPrompt, link, 2048);
  return JSON.parse(extractJSON(response));
}

// ========== 生成一周食谱（v3: +保健品 +外卖库 +单位 +维生素） ==========
export async function generateMealPlan(
  apiKey: string,
  profile: BodyProfile,
  analysis: BodyAnalysis,
  pantry: PantryItem[],
  supplements: Supplement[] = [],
  takeoutDishes: TakeoutDish[] = []
): Promise<WeeklyMealPlan> {
  const isNoCook = profile.cookingPreference === 'nocook';
  const isCarbCycle = profile.dietMethod === 'carb-cycle';
  const hasSupplements = supplements.length > 0;
  const hasTakeoutDB = takeoutDishes.length > 0;

  // 外卖库描述
  const takeoutDesc = hasTakeoutDB
    ? takeoutDishes.map(d =>
        `[ID:${d.id}] ${d.name}（${d.restaurant}）| ${d.nutrition.calories}kcal P${d.nutrition.protein}g C${d.nutrition.carbs}g F${d.nutrition.fat}g | ${d.amount}`
      ).join('\n')
    : '无外卖数据库';

  const systemPrompt = `你是专业营养膳食规划AI。根据用户数据生成一周饮食计划。

严格遵循：
1. 每天4餐：breakfast,lunch,dinner,snack
2. 每日总热量接近目标，±100kcal
3. 优先用已有食材，标记fromPantry=true，填pantryItemId和pantryItemName
4. 中式饮食，食材多样

${isNoCook ? `【不开火模式】只能从以下来源选：
- 外卖菜品库（见下方，从中选择，确保一周内不重复）
- 即食产品（便利店饭团、即食沙拉、酸奶、水果、面包、三明治）
- 冲泡类（代餐奶昔、燕麦片、速食汤、豆浆粉）
- 无需烹饪的（水煮蛋、牛奶、坚果、蛋白棒）
每餐标注cookingMethod："外卖""即食""冲泡""生食""微波"
外卖库共有${takeoutDishes.length}道菜，一周选${Math.min(takeoutDishes.length, 14)}道不同菜品，分散到各餐。` : `【可以开火烹饪】推荐各种做法，cookingMethod标注："煎""蒸""煮""炒""烤""焖""生食""微波"`}

${isCarbCycle ? `【碳循环】每天标注carbCyclePhase：高碳日(high-carb,碳水≥50%,安排2天)、中碳日(medium-carb,碳水30-40%,安排2天)、低碳日(low-carb,碳水≤20%,安排2天)、无碳日(no-carb,碳水接近0,安排1天)。高强度训练日配高碳。` : '不需要carbCyclePhase。'}

${hasSupplements ? `【维他命&保健品】用户有以下保健品，请在每天的supplements数组中安排：
${supplements.map(s => `- [ID:${s.id}] ${s.name}(${s.brand}) | ${s.dosage} | 服用时机：${s.timing}(before_meal=饭前/with_meal=随餐/after_meal=饭后) | 最佳餐次：${s.bestMeal || '不限定'}`).join('\n')}
注意：严格按说明安排时机和餐次，每天都要安排。` : '无保健品。'}

返回严格JSON：
{
  "days": [{
    "day": "monday",
    "meals": {
      "breakfast": [{"name":"食物名","amount":"份量","calories":数字,"protein":数字,"carbs":数字,"fat":数字,"cookingMethod":"烹饪方式","fromPantry":true/false,"pantryItemId":"","pantryItemName":"","isSupplement":false}],
      "lunch": [...],
      "dinner": [...],
      "snack": [...]
    },
    "dailyTotals":{"calories":数字,"protein":数字,"carbs":数字,"fat":数字},
    ${isCarbCycle ? '"carbCyclePhase":"high-carb|medium-carb|low-carb|no-carb",' : ''}
    "cookingNote":"当日简述",
    ${hasSupplements ? '"supplements":[{"supplementId":"保健品id","name":"名称","timing":"before_meal|with_meal|after_meal","meal":"breakfast|lunch|dinner|snack"}]' : ''}
  }],
  "pantryUsageSummary":[{"pantryItemId":"id","name":"名称","usedPerWeek":每周用量,"remainingWeeks":剩余周数,"daysToEmpty":消耗完天数}],
  "totalDaysToGoal":到达目标体重天数
}
JSON完整闭合，不截断。`;

  const pantryDesc = pantry.length > 0
    ? pantry.map(p => `-[ID:${p.id}] ${p.name} ${p.brand||''} | ${p.nutrition?`${p.nutrition.calories}kcal/100g P${p.nutrition.protein}g C${p.nutrition.carbs}g F${p.nutrition.fat}g`:'未分析'} | 剩余:${p.remainingQuantity??p.totalQuantity}${p.unit}`).join('\n')
    : '无';

  const diff = profile.targetWeight - profile.weight;
  const userMsg = `
性别：${profile.gender==='male'?'男':'女'} 年龄${profile.age} | 身高${profile.height}cm | 体重${profile.weight}kg→目标${profile.targetWeight}kg
体脂${profile.bodyFat}% | 目标：${profile.goal==='cut'?'减脂':profile.goal==='bulk'?'增肌':'维持'} | 饮食：${profile.dietMethod}
烹饪：${profile.cookingPreference==='cook'?'开火':'不开火'} | 日热量${analysis.targetCalories}kcal
蛋白${analysis.macroSplit.protein}g 碳水${analysis.macroSplit.carbs}g 脂肪${analysis.macroSplit.fat}g

${hasTakeoutDB ? '【外卖菜品库（不开火时只能从这里选外卖）】\n' + takeoutDesc + '\n' : ''}
【已有食材】\n${pantryDesc}
`;

  const response = await callDeepSeek(apiKey, systemPrompt, userMsg, 8192);
  const plan = JSON.parse(extractJSON(response)) as WeeklyMealPlan;
  plan.generatedAt = Date.now();
  return plan;
}
