import type { BodyProfile, BodyAnalysis, PantryItem, WeeklyMealPlan } from '../types';

const API_BASE = 'https://api.deepseek.com';

async function callDeepSeek(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 8192
): Promise<string> {
  const res = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error (${res.status}): ${err}`);
  }

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
export async function analyzeBodyProfile(
  apiKey: string,
  profile: BodyProfile
): Promise<BodyAnalysis> {
  const systemPrompt = `你是一位专业的营养学与运动科学AI。根据用户的身体数据，计算并返回JSON格式的分析结果。

计算规则：
- bmi: 体重(kg) / (身高(m))²，保留1位小数
- bmr: 用Mifflin-St Jeor公式（男: 10×体重+6.25×身高-5×年龄+5 / 女: 10×体重+6.25×身高-5×年龄-161）
- tdee: BMR × 活动系数。默认轻度活动×1.375（如果你是运动员则为×1.725）
- targetCalories: 减脂 = TDEE-300~500，增肌 = TDEE+300~500，维持 = TDEE
- macroSplit: 按目标分配蛋白质(g)、碳水(g)、脂肪(g)
  - 减脂: 蛋白2.2g/kg体重 | 碳水=剩余热量 | 脂肪≥0.8g/kg
  - 增肌: 蛋白1.8g/kg体重 | 碳水=剩余热量 | 脂肪≥1g/kg
  - 维持: 蛋白1.6g/kg体重 | 碳水=剩余热量 | 脂肪≥0.8g/kg
- estimatedDaysToGoal: 根据热量缺口/盈余估算到达目标体重的天数
  - 1kg体脂 ≈ 7700kcal。减脂每周减0.5-1kg为健康速率
  - 计算: |目标体重-当前体重| ÷ 每周减重速度 × 7
- weeklyWeightChange: 每周预计体重变化kg（正=增重，负=减重，保留1位小数）
- summary: 3-4句话，包含：身体现状评估、BMR说明、目标热量建议、达到目标体重的预计时间

返回严格的合法JSON，不要包含任何其他文字。`;

  const diff = profile.targetWeight - profile.weight;
  const weightDir = diff > 0 ? '增重' : diff < 0 ? '减重' : '维持';

  const userMsg = `
身体数据：
- 性别：${profile.gender === 'male' ? '男' : '女'}
- 年龄：${profile.age}岁
- 身高：${profile.height}cm
- 体重：${profile.weight}kg
- 目标体重：${profile.targetWeight}kg（需${weightDir}${Math.abs(diff).toFixed(1)}kg）
- 体脂率：${profile.bodyFat}%（如果为0表示未测量）
- 目标：${profile.goal === 'cut' ? '减脂' : profile.goal === 'bulk' ? '增肌' : '维持体重'}
- 饮食方式：${profile.dietMethod}
`;

  const response = await callDeepSeek(apiKey, systemPrompt, userMsg);
  const json = extractJSON(response);
  return JSON.parse(json) as BodyAnalysis;
}

// ========== 搜索食材营养信息（增强版：品牌识别 + 产品图片） ==========
export async function searchFoodNutrition(
  apiKey: string,
  foodNames: string[]
): Promise<{
  results: Array<{
    name: string;
    brand: string;
    category: string;
    nutrition: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
    bestMealTime: string[];
    imageUrl: string;
    notes: string;
  }>;
}> {
  const systemPrompt = `你是一位食品营养专家，同时熟悉国内外主流品牌产品。用户提供食材/产品名称列表，你需要给出每种产品的详细信息。

返回严格JSON格式（不要包含其他文字）：
{
  "results": [
    {
      "name": "产品名称",
      "brand": "品牌名（如果能从名称中识别，如\"伊利纯牛奶\"→品牌\"伊利\"；如无法识别则填\"通用\"）",
      "category": "protein|carb|fat|vegetable|fruit|dairy|other",
      "nutrition": {
        "calories": 每100g热量(kcal),
        "protein": 每100g蛋白质(g),
        "carbs": 每100g碳水化合物(g),
        "fat": 每100g脂肪(g),
        "fiber": 每100g膳食纤维(g)
      },
      "bestMealTime": ["breakfast","lunch","dinner","snack"] 中适合的餐次,
      "imageUrl": "产品图片搜索URL（格式：https://search.jd.com/Search?keyword=产品名+品牌名 或留空字符串）",
      "notes": "15字左右简短说明，含烹饪/食用建议"
    }
  ]
}`;

  const userMsg = `请分析以下产品/食材的营养信息（包含品牌识别）：${foodNames.join('、')}`;

  const response = await callDeepSeek(apiKey, systemPrompt, userMsg);
  const json = extractJSON(response);
  return JSON.parse(json);
}

// ========== 解析购买链接 ==========
export async function parsePurchaseLink(
  apiKey: string,
  link: string
): Promise<{ name: string; brand: string; estimatedQuantity: number; unit: string; notes: string }> {
  const systemPrompt = `你是一位电商产品分析专家。用户提供购买链接，你根据链接中的商品信息分析出产品详情。
返回严格JSON（不要包含其他文字）：
{
  "name": "产品名称",
  "brand": "品牌名",
  "estimatedQuantity": 估计份量/重量数字（如500表示500g，12表示12个）,
  "unit": "单位(g/个/袋/瓶/盒/包)",
  "notes": "简短说明"
}
如果无法从链接中识别出具体产品，name和brand填"未知商品"，并在notes中说明原因。`;

  const userMsg = `请分析这个购买链接中的产品信息：${link}`;

  const response = await callDeepSeek(apiKey, systemPrompt, userMsg, 2048);
  const json = extractJSON(response);
  return JSON.parse(json);
}

// ========== 生成一周食谱（增强版） ==========
export async function generateMealPlan(
  apiKey: string,
  profile: BodyProfile,
  analysis: BodyAnalysis,
  pantry: PantryItem[]
): Promise<WeeklyMealPlan> {
  const systemPrompt = `你是一位专业的营养膳食规划AI。根据用户的身体数据、营养目标和已有食材，生成一周（周一至周日）的饮食计划。

重要要求：
1. 每天包含4餐：早餐(breakfast)、午餐(lunch)、晚餐(dinner)、加餐(snack)
2. 每日总热量接近targetCalories，±100kcal
3. 蛋白质、碳水、脂肪比例合理
4. 优先使用用户已有食材(pantryItems)，合理穿插进各餐，使用已有食材的条目标记fromPantry=true并填写pantryItemId和pantryItemName
5. 食物选择符合中式饮食习惯
6. 食材多样，不要重复太多
7. 标注每餐的cookingMethod（如"煎""蒸""煮""炒""即食""冲泡""外卖""烤""生食""焖"等）
8. ${profile.cookingPreference === 'nocook' ? '用户选择"不开火"，请尽量推荐：外卖可点的菜肴、即食产品（便利店饭团/沙拉/三明治）、只需热水冲泡的食物（代餐奶昔/燕麦/泡面/速食汤）、不需要烹饪的生食（水果/酸奶/坚果）。避免需要开火煎炒煮的菜。' : '用户有烹饪条件，可以推荐需要烹饪的菜肴。'}
9. ${profile.dietMethod === 'carb-cycle' ? '碳循环模式：请为每天标注carbCyclePhase（high-carb/medium-carb/low-carb/no-carb），高碳日2天、中碳日2天、低碳日2天、无碳日1天。高碳日碳水占比≥50%，低碳日碳水≤20%。' : '不需要碳循环标注'}
10. 生成pantryUsageSummary：对每种在食谱中使用的已有食材，计算：
   - usedPerWeek: 一周总用量（g或份）
   - remainingWeeks: 剩余可用周数（remainingQuantity ÷ usedPerWeek）
   - daysToEmpty: 预计多少天后消耗完

返回严格的合法JSON（不要包含其他文字）：
{
  "days": [
    {
      "day": "monday",
      "meals": {
        "breakfast": [{ "name": "食物名", "amount": "份量（如150g或1个）", "calories": 数字, "protein": 数字, "carbs": 数字, "fat": 数字, "cookingMethod": "烹饪方式", "fromPantry": true/false, "pantryItemId": "对应id或空字符串", "pantryItemName": "对应食材名或空字符串" }],
        "lunch": [...],
        "dinner": [...],
        "snack": [...]
      },
      "dailyTotals": { "calories": 数字, "protein": 数字, "carbs": 数字, "fat": 数字 },
      "carbCyclePhase": "${profile.dietMethod === 'carb-cycle' ? '"high-carb""low-carb""no-carb""medium-carb"之一' : '不填'}",
      "cookingNote": "当日烹饪方式简述"
    }
  ],
  "pantryUsageSummary": [
    { "pantryItemId": "食材id", "name": "食材名", "usedPerWeek": 数字, "remainingWeeks": 数字, "daysToEmpty": 数字 }
  ],
  "totalDaysToGoal": 预计按此计划执行多少天达到目标体重
}

请保证JSON完整闭合，不要截断。`;

  const pantryDesc = pantry.length > 0
    ? pantry.map(p =>
        `- [ID:${p.id}] ${p.name} ${p.brand ? '(' + p.brand + ')' : ''} | 分类:${p.category} | ${p.nutrition ? `${p.nutrition.calories}kcal/100g 蛋白${p.nutrition.protein}g 碳水${p.nutrition.carbs}g 脂肪${p.nutrition.fat}g` : '营养未分析'} | 剩余:${p.remainingQuantity ?? p.totalQuantity}${p.unit}`
      ).join('\n')
    : '无已有食材';

  const diff = profile.targetWeight - profile.weight;
  const weightDir = diff > 0 ? '增重' : diff < 0 ? '减重' : '维持';

  const userMsg = `
用户资料：
- 性别：${profile.gender === 'male' ? '男' : '女'}，年龄${profile.age}岁
- 身高${profile.height}cm，当前体重${profile.weight}kg，目标体重${profile.targetWeight}kg（需${weightDir}${Math.abs(diff).toFixed(1)}kg）
- 体脂率${profile.bodyFat}%
- 目标：${profile.goal === 'cut' ? '减脂' : profile.goal === 'bulk' ? '增肌' : '维持'}
- 饮食方式：${profile.dietMethod}
- 烹饪条件：${profile.cookingPreference === 'cook' ? '可以开火烹饪' : '不开火（需要外卖/即食/冲泡类食物）'}
- 每日目标热量：${analysis.targetCalories}kcal
- 蛋白质${analysis.macroSplit.protein}g / 碳水${analysis.macroSplit.carbs}g / 脂肪${analysis.macroSplit.fat}g
- 预计每周${weightDir}${Math.abs(analysis.weeklyWeightChange ?? 0.5)}kg

已有食材（请优先使用）：
${pantryDesc}
`;

  const response = await callDeepSeek(apiKey, systemPrompt, userMsg, 8192);
  const json = extractJSON(response);
  const plan = JSON.parse(json) as WeeklyMealPlan;
  plan.generatedAt = Date.now();
  return plan;
}
