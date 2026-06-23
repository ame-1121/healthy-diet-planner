import type { BodyProfile, BodyAnalysis, PantryItem, WeeklyMealPlan } from '../types';

const API_BASE = 'https://api.deepseek.com';

async function callDeepSeek(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 4096
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
  // 尝试从 markdown 代码块中提取 JSON
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  // 尝试直接找到 JSON 对象
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
严格按照以下字段返回：
- bmi: BMI值（保留1位小数）
- bmr: 基础代谢率（kcal/天，Mifflin-St Jeor公式计算）
- tdee: 每日总消耗（BMR乘以活动系数，假设轻度活动×1.375）
- targetCalories: 根据目标调整的热量（减脂减300-500，增肌加300-500，维持不变）
- macroSplit: 蛋白质(g)、碳水(g)、脂肪(g)的每日建议量
- summary: 2-3句话的总体分析建议

返回严格的合法JSON，不要包含任何其他文字。`;

  const userMsg = `
身体数据：
- 性别：${profile.gender === 'male' ? '男' : '女'}
- 年龄：${profile.age}岁
- 身高：${profile.height}cm
- 体重：${profile.weight}kg
- 体脂率：${profile.bodyFat}%（如果为0表示未测量）
- 目标：${profile.goal === 'cut' ? '减脂' : profile.goal === 'bulk' ? '增肌' : '维持体重'}
- 饮食方式：${profile.dietMethod}
`;

  const response = await callDeepSeek(apiKey, systemPrompt, userMsg);
  const json = extractJSON(response);
  return JSON.parse(json) as BodyAnalysis;
}

// ========== 搜索食材营养信息 ==========
export async function searchFoodNutrition(
  apiKey: string,
  foodNames: string[]
): Promise<{ results: Array<{ name: string; category: string; nutrition: { calories: number; protein: number; carbs: number; fat: number; fiber: number }; bestMealTime: string[]; notes: string }> }> {
  const systemPrompt = `你是一位食品营养专家。用户提供食材名称列表，你需要通过网络搜索能力给出每种食材的营养信息。
返回严格JSON格式（不要包含其他文字）：
{
  "results": [
    {
      "name": "食材名称",
      "category": "protein|carb|fat|vegetable|fruit|dairy|other",
      "nutrition": {
        "calories": 每100g热量(kcal),
        "protein": 每100g蛋白质(g),
        "carbs": 每100g碳水化合物(g),
        "fat": 每100g脂肪(g),
        "fiber": 每100g膳食纤维(g)
      },
      "bestMealTime": ["breakfast","lunch","dinner","snack"] 中适合的餐次,
      "notes": "简短说明该食材的特点和烹饪建议"
    }
  ]
}`;

  const userMsg = `请分析以下食材的营养信息：${foodNames.join('、')}`;

  const response = await callDeepSeek(apiKey, systemPrompt, userMsg);
  const json = extractJSON(response);
  return JSON.parse(json);
}

// ========== 生成一周食谱 ==========
export async function generateMealPlan(
  apiKey: string,
  profile: BodyProfile,
  analysis: BodyAnalysis,
  pantry: PantryItem[]
): Promise<WeeklyMealPlan> {
  const systemPrompt = `你是一位专业的营养膳食规划AI。根据用户的身体数据、营养目标和已有食材，生成一周（周一至周日）的饮食计划。

要求：
1. 每天包含4餐：早餐(breakfast)、午餐(lunch)、晚餐(dinner)、加餐(snack)
2. 每日总热量接近targetCalories，±100kcal
3. 蛋白质、碳水、脂肪比例合理
4. 优先使用用户已有食材(pantryItems)，合理穿插进各餐
5. 使用fromPantry标记是否为已有食材
6. 食物选择符合中式饮食习惯
7. 考虑碳循环/间歇断食等特殊饮食方式
8. 食材多样，不要重复太多

返回严格的合法JSON（不要包含其他文字）：
{
  "days": [
    {
      "day": "monday",
      "meals": {
        "breakfast": [{ "name": "食物名", "amount": "份量（如150g或1个）", "calories": 数字, "protein": 数字, "carbs": 数字, "fat": 数字, "fromPantry": true/false, "pantryItemId": "对应key或空" }],
        "lunch": [...],
        "dinner": [...],
        "snack": [...]
      },
      "dailyTotals": { "calories": 数字, "protein": 数字, "carbs": 数字, "fat": 数字 }
    }
  ]
}

请保证JSON完整闭合，不要截断。`;

  const pantryDesc = pantry.length > 0
    ? pantry.map(p =>
        `- ${p.name}（${p.category}，${p.nutrition ? `${p.nutrition.calories}kcal/100g 蛋白${p.nutrition.protein}g 碳水${p.nutrition.carbs}g 脂肪${p.nutrition.fat}g` : '营养未分析'}，量: ${p.quantity ?? 1}${p.unit ?? '份'}）`
      ).join('\n')
    : '无已有食材';

  const userMsg = `
用户资料：
- 性别：${profile.gender === 'male' ? '男' : '女'}，年龄${profile.age}岁
- 身高${profile.height}cm，体重${profile.weight}kg，体脂率${profile.bodyFat}%
- 目标：${profile.goal === 'cut' ? '减脂' : profile.goal === 'bulk' ? '增肌' : '维持'}
- 饮食方式：${profile.dietMethod}
- 每日目标热量：${analysis.targetCalories}kcal
- 蛋白质${analysis.macroSplit.protein}g / 碳水${analysis.macroSplit.carbs}g / 脂肪${analysis.macroSplit.fat}g

已有食材：
${pantryDesc}
`;

  const response = await callDeepSeek(apiKey, systemPrompt, userMsg, 8192);
  const json = extractJSON(response);
  const plan = JSON.parse(json) as WeeklyMealPlan;
  plan.generatedAt = Date.now();
  return plan;
}
