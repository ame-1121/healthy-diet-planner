import type { BodyProfile, BodyAnalysis, PantryItem, Supplement, TakeoutDish, WeeklyMealPlan } from '../types';

const API_BASE = 'https://api.deepseek.com';
const MODEL = 'deepseek-chat';

// ==================== 核心：调用 DeepSeek ====================
async function chat(
  apiKey: string,
  system: string,
  user: string,
  maxTokens = 2048
): Promise<string> {
  const res = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,  // 低温度提高 JSON 稳定性
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API (${res.status}): ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  if (data.choices[0].finish_reason === 'length') {
    throw new Error('AI 输出被截断（token 不足），已自动增加，请重试。');
  }
  return data.choices[0].message.content;
}

// ==================== 超粗暴 JSON 提取 ====================
function parseAIResponse<T>(raw: string, label: string): T {
  // 第一步：打印原始输出的头尾便于调试
  const head = raw.slice(0, 200);
  const tail = raw.length > 200 ? raw.slice(-100) : '';

  // 第二步：删除所有反引号字符（彻底消灭 markdown fence）
  let text = raw.replace(/`/g, '');

  // 第三步：精确找最外层 { ... }
  const start = text.indexOf('{');
  if (start === -1) {
    throw new Error(`${label}: 未找到 JSON ({})\n原始(前200字): ${head}`);
  }

  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  let json = '';
  if (end === -1) {
    // JSON 不完整，取到末尾并尝试补闭合括号
    json = text.slice(start);
    let depth2 = 0;
    for (const ch of json) {
      if (ch === '{') depth2++;
      else if (ch === '}') depth2--;
    }
    if (depth2 > 0) json += '}'.repeat(depth2);
    // 同样补数组
    let arrDepth = 0;
    for (const ch of json) { if (ch === '[') arrDepth++; else if (ch === ']') arrDepth--; }
    if (arrDepth > 0) json += ']'.repeat(arrDepth);
  } else {
    json = text.slice(start, end + 1);
  }

  // 第四步：修复常见 JSON 语法错误
  json = json
    .replace(/,\s*}/g, '}')      // 多余逗号 }
    .replace(/,\s*]/g, ']')      // 多余逗号 ]
    .replace(/,\s*,/g, ',')      // 连续逗号
    // eslint-disable-next-line
    .replace(/:\s*undefined/g, ':null')  // undefined → null
    .replace(/:\s*NaN/g, ':null');       // NaN → null

  // 第五步：尝试解析
  try {
    return JSON.parse(json) as T;
  } catch (e1: any) {
    // 第六步：更暴力的修复——按字符串逐字符重新组装
    try {
      const repaired = bruteForceRepair(json);
      return JSON.parse(repaired) as T;
    } catch (e2: any) {
      throw new Error(
        `${label} 解析失败:\n` +
        `步骤1: ${e1.message}\n` +
        `步骤2: ${e2.message}\n\n` +
        `原始前200字: ${head}\n` +
        `原始后100字: ${tail}\n` +
        `提取JSON前200字: ${json.slice(0, 200)}`
      );
    }
  }
}

function bruteForceRepair(json: string): string {
  // 逐字符重建，在字符串外修复常见问题
  const out: string[] = [];
  let inStr = false;
  let prev = '';
  let i = 0;

  while (i < json.length) {
    const ch = json[i];

    // 追踪字符串状态
    if (ch === '"' && prev !== '\\') {
      inStr = !inStr;
    }

    if (inStr) {
      // 在字符串内部，原样保留但修复非法转义
      if (ch === '\\' && i + 1 < json.length) {
        const next = json[i + 1];
        if (!'"\\/bfnrtu'.includes(next)) {
          // 非法转义，吞掉反斜杠
          out.push(next);
          i += 2;
          prev = ch;
          continue;
        }
      }
      out.push(ch);
    } else {
      // 在字符串外部
      // 跳过字符串外的换行符
      if (ch === '\n' || ch === '\r') {
        prev = ch;
        i++;
        continue;
      }
      out.push(ch);
    }

    prev = ch;
    i++;
  }

  let result = out.join('');

  // 补括号
  let brace = 0, bracket = 0;
  for (const ch of result) {
    if (ch === '{') brace++;
    else if (ch === '}') brace--;
    else if (ch === '[') bracket++;
    else if (ch === ']') bracket--;
  }
  while (brace > 0) { result += '}'; brace--; }
  while (bracket > 0) { result += ']'; bracket--; }

  return result;
}

// ==================== 1. 分析身体数据 ====================
export async function analyzeBodyProfile(apiKey: string, profile: BodyProfile): Promise<BodyAnalysis> {
  const system = `你是注册营养师。严格按公式计算并只返回 JSON，不要任何解释。

计算公式：
- BMI = 体重/(身高m)²，保留1位小数
- BMR(Mifflin-St Jeor): 男=10×体重+6.25×身高-5×年龄+5, 女=10×体重+6.25×身高-5×年龄-161
- TDEE = BMR × 1.375
- targetCalories: 减脂=TDEE-400, 增肌=TDEE+350, 维持=TDEE
- protein(g): 减脂=2.2×体重, 增肌=1.8×体重, 维持=1.6×体重
- fat(g): max(0.8×体重, 总热量×0.2÷9)
- carbs(g): (targetCalories - protein×4 - fat×9) ÷ 4
- estimatedDaysToGoal: |目标体重-当前| ÷ 0.6 × 7
- weeklyWeightChange: 正=增重,负=减重

{
  "bmi":0,"bmr":0,"tdee":0,"targetCalories":0,
  "macroSplit":{"protein":0,"carbs":0,"fat":0},
  "estimatedDaysToGoal":0,"weeklyWeightChange":0,
  "summary":"3句中文建议"
}`;

  const diff = profile.targetWeight - profile.weight;
  const user = `${profile.gender==='male'?'男':'女'} ${profile.age}岁 ${profile.height}cm ${profile.weight}→${profile.targetWeight}kg(${diff>0?'增':diff<0?'减':'维持'}${Math.abs(diff).toFixed(1)}) 体脂${profile.bodyFat}% ${profile.goal} ${profile.dietMethod} ${profile.cookingPreference}`;

  const raw = await chat(apiKey, system, user, 1024);
  return parseAIResponse<BodyAnalysis>(raw, '身体数据分析');
}

// ==================== 2. 食材营养查询 ====================
export async function searchFoodNutrition(apiKey: string, foods: string[]): Promise<{
  results: Array<{
    name: string; brand: string; category: string;
    nutrition: { calories: number; protein: number; carbs: number; fat: number; fiber: number; caffeine?: number };
    bestMealTime: string[]; isDrink: boolean; drinkType: string; imageUrl: string; notes: string;
  }>;
}> {
  const system = `食品营养专家。只返回 JSON。饮品识别: 茶叶→drink/tea, 咖啡→drink/coffee, 花草茶(菊花/枸杞/玫瑰/金银花等)→drink/herbal, 冲剂(蛋白粉/代餐粉/电解质等冲泡品)→drink/supplement_drink。

每100g/ml 营养数据。caffeine mg/100ml(绿茶~30,红茶~40,乌龙~25,普洱~20,花草茶0)。

{"results":[{"name":"","brand":"","category":"protein|carb|fat|vegetable|fruit|dairy|drink|other","nutrition":{"calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"caffeine":0},"bestMealTime":["breakfast"],"isDrink":false,"drinkType":"tea|coffee|herbal|supplement_drink|other_drink|none","imageUrl":"","notes":""}]}`;

  const raw = await chat(apiKey, system, `分析: ${foods.join('、')}`, 4096);
  return parseAIResponse(raw, '食材分析');
}

// ==================== 3. 购买链接解析 ====================
export async function parsePurchaseLink(apiKey: string, link: string): Promise<{
  name: string; brand: string; estimatedQuantity: number; unit: string; category: string; isDrink: boolean; notes: string;
}> {
  const system = `电商商品提取。支持 淘宝/京东/拼多多/抖音/1688/小红书/美团 等链接。
{"name":"产品名(精确到规格)","brand":"品牌(不可知则'通用')","estimatedQuantity":1,"unit":"g/个/袋/瓶/盒/包/罐","category":"protein|carb|fat|vegetable|fruit|dairy|drink|other|unknown","isDrink":false,"notes":"(简短说明)"}
饮品/茶/咖啡/冲剂类 isDrink=true,category="drink"。完全无法识别 name="未知商品"。`;

  const raw = await chat(apiKey, system, link, 1024);
  return parseAIResponse(raw, '链接识别');
}

// ==================== 4. 生成一周食谱 ====================
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
  const hasSupp = supplements.length > 0;
  const hasTakeout = takeoutDishes.length > 0;

  const priorityItems = pantry.filter(p => p.priority && (p.remainingQuantity ?? p.totalQuantity) > 0);
  const drinkItems = pantry.filter(p => p.isDrink || p.category === 'drink');
  const allItems = [...priorityItems, ...pantry.filter(p => !p.priority)];

  // 食材描述 (压缩)
  const pantryStr = allItems.length > 0
    ? allItems.map(p => {
        const prio = p.priority ? '⚡' : '';
        const nut = p.nutrition ? `${p.nutrition.calories}kcal P${p.nutrition.protein} C${p.nutrition.carbs} F${p.nutrition.fat}` : '?';
        return `[${p.id}]${prio}${p.name}|${nut}|${p.remainingQuantity??p.totalQuantity}${p.unit}`;
      }).join('; ')
    : '空';

  // 外卖库 (压缩)
  const takeoutStr = hasTakeout
    ? takeoutDishes.map(d => `[${d.id}]${d.name}(${d.restaurant})${d.nutrition.calories}kcal`).join('; ')
    : '';

  // 构建系统提示词
  const parts: string[] = [];

  parts.push(`你是顶级注册营养师。生成一周7天、每天4餐(breakfast/lunch/dinner/snack)的饮食计划。只返回 JSON。`);

  parts.push(`规则：
- 日热量≈${analysis.targetCalories}kcal(±80) P${analysis.macroSplit.protein}g C${analysis.macroSplit.carbs}g F${analysis.macroSplit.fat}g
- 早高蛋白+碳水，午均衡+蔬菜，晚低碳+高蛋白，加餐轻蛋白
- 晚餐碳水≤全天25%，睡前3h完成，蛋白≥25g/餐
- 中式，一周≥25种食材`);

  if (priorityItems.length > 0) {
    parts.push(`⚡优先消耗(前3天集中用): ${priorityItems.map(p => p.name).join('、')}`);
  }

  if (drinkItems.length > 0) {
    parts.push(`🍵饮水: 每天waterIntake含5-8条(茶上午/花草全天,咖啡因<400mg,饮品:${drinkItems.map(d=>d.name).join('、')})`);
  } else {
    parts.push('🍵饮水: 每天waterIntake含5-8条，总饮水量2-2.5L');
  }

  if (hasSupp) {
    parts.push(`💊保健品(AI决定服用时机): ${supplements.map(s=>`${s.name}(${s.dosage})`).join('、')}。原则:脂溶维随脂餐,维C早午,B族早,铁剂早后1h+维C,钙晚,镁睡前,锌随餐,鱼油随脂餐,益生菌空腹`);
  }

  if (isNoCook) {
    parts.push(`🛵不开火:仅外卖/即食/冲泡/生食/微波${hasTakeout?`，外卖库:${takeoutStr}`:''}`);
  } else {
    parts.push('🍳开火:煎蒸煮炒烤焖炖凉拌');
  }

  if (isCarbCycle) {
    // 根据用户日热量计算各阶段的碳水克数
    const highCarbG = Math.round(analysis.targetCalories * 0.50 / 4);  // 50%热量来自碳水
    const mediumCarbG = Math.round(analysis.targetCalories * 0.35 / 4); // 35%
    const lowCarbG = Math.round(analysis.targetCalories * 0.15 / 4);    // 15%
    const noCarbG = Math.round(30 / 4); // <30g净碳水

    parts.push(`🔄 碳循环（严格遵守！每天必须标注carbCyclePhase且碳水克数必须达标）：

┌──────────┬──────────┬──────────────────────────────┬────────────────┐
│ 日期     │ 碳水类型 │ carbCyclePhase 值           │ 碳水目标(g)    │
├──────────┼──────────┼──────────────────────────────┼────────────────┤
│ 周一 Tue │ 高碳日   │ "high-carb"                  │ ≥${highCarbG}g │
│ 周二 Wed │ 高碳日   │ "high-carb"                  │ ≥${highCarbG}g │
│ 周三 Thu │ 中碳日   │ "medium-carb"                │ ≈${mediumCarbG}g│
│ 周四 Fri │ 中碳日   │ "medium-carb"                │ ≈${mediumCarbG}g│
│ 周五 Sat │ 低碳日   │ "low-carb"                   │ ≤${lowCarbG}g  │
│ 周六 Sun │ 低碳日   │ "low-carb"                   │ ≤${lowCarbG}g  │
│ 周日 Mon │ 无碳日   │ "no-carb"                    │ <${noCarbG}g   │
└──────────┴──────────┴──────────────────────────────┴────────────────┘

高碳日: 碳水≥${highCarbG}g, 脂肪<50g, 碳水集中在早/午餐+训练前后
中碳日: 碳水≈${mediumCarbG}g, 脂肪50-70g, 碳水集中在早/午餐
低碳日: 碳水≤${lowCarbG}g, 脂肪70-90g, 晚餐0碳水
无碳日: 碳水<${noCarbG}g(仅蔬菜纤维), 脂肪80-100g, 主打蛋白质+大量蔬菜+健康脂肪

每日dailyTotals.carbs必须匹配上表！cookingNote注明碳水量级。`
    );
  }

  // JSON 模板
  const carbPhaseField = isCarbCycle ? '"carbCyclePhase":"high-carb",' : '';
  const suppField = hasSupp ? '"supplements":[{"supplementId":"","name":"","timing":"before_meal|with_meal|after_meal","meal":"breakfast|lunch|dinner|snack"}],' : '';

  parts.push(`JSON模板:
{"days":[{
"day":"monday",
"meals":{"breakfast":[{"name":"","amount":"","calories":0,"protein":0,"carbs":0,"fat":0,"cookingMethod":"","fromPantry":false,"pantryItemId":"","pantryItemName":"","isSupplement":false}],"lunch":[],"dinner":[],"snack":[]},
"dailyTotals":{"calories":0,"protein":0,"carbs":0,"fat":0},
${carbPhaseField}
"cookingNote":"",
${suppField}
"waterIntake":{"totalMl":0,"schedule":[{"time":"08:00","amountMl":300,"drinkName":"温水","note":""}]}
}],
"pantryUsageSummary":[{"pantryItemId":"","name":"","usedPerWeek":0,"remainingWeeks":0,"daysToEmpty":0}],
"totalDaysToGoal":${analysis.estimatedDaysToGoal},
"waterOverview":""
}`);

  const diff = profile.targetWeight - profile.weight;

  const user = `${profile.gender==='male'?'男':'女'} ${profile.age}岁 ${profile.height}cm ${profile.weight}→${profile.targetWeight}kg(${diff>0?'增':diff<0?'减':'维持'}${Math.abs(diff).toFixed(1)}kg) 体脂${profile.bodyFat}%

食材: ${pantryStr}
${priorityItems.length>0?'⚠️优先消耗食材前3天用完!':''}
${drinkItems.length>0?'🍵饮品需入饮水schedule。':''}
${hasSupp?'💊保健品自动安排。':''}
${isCarbCycle ? '🔄碳循环：每天dailyTotals.carbs和carbCyclePhase必须严格对准上表!!' : ''}

输出完整JSON(7天×4餐，全部字段不可省)。`;

  const systemPrompt = parts.join('\n\n');
  const raw = await chat(apiKey, systemPrompt, user, 16384);

  // 解析
  const plan = parseAIResponse<WeeklyMealPlan>(raw, '食谱生成');
  plan.generatedAt = Date.now();
  return plan;
}
