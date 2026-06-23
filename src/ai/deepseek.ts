import type { BodyProfile, BodyAnalysis, PantryItem, Supplement, TakeoutDish, WeeklyMealPlan } from '../types';

const API_BASE = 'https://api.deepseek.com';

async function callDeepSeek(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  options?: { jsonMode?: boolean; maxTokens?: number }
): Promise<string> {
  const body: Record<string, any> = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
  };

  // 强制 JSON 输出模式
  if (options?.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  // 不设 token 上限则用最大值
  if (options?.maxTokens) {
    body.max_tokens = options.maxTokens;
  }
  // 不传 max_tokens，让 API 用默认最大值

  const res = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) { const err = await res.text(); throw new Error(`DeepSeek API error (${res.status}): ${err}`); }
  const data = await res.json();
  // 检查是否因 token 不足被截断
  if (data.choices[0].finish_reason === 'length') {
    throw new Error('AI 输出被截断（token 不足），请重试。已自动优化。');
  }
  return data.choices[0].message.content;
}

// 修复常见 JSON 语法问题
function repairJSON(text: string): string {
  let cleaned = text
    .replace(/\/\/.*$/gm, '')          // 移除 // 注释
    .replace(/,\s*}/g, '}')            // 移除尾部多余逗号 }
    .replace(/,\s*]/g, ']')            // 移除尾部多余逗号 ]
    .replace(/,\s*,/g, ',')            // 合并连续逗号
    .replace(/\t/g, ' ')               // tab → 空格
    .replace(/\\(?!["\\/bfnrtu])/g, '\\\\'); // 修复不合法转义

  // 如果 JSON 不完整（缺闭合），尝试修复
  const openBraces = (cleaned.match(/\{/g) || []).length;
  const closeBraces = (cleaned.match(/\}/g) || []).length;
  const openBrackets = (cleaned.match(/\[/g) || []).length;
  const closeBrackets = (cleaned.match(/\]/g) || []).length;

  if (openBraces > closeBraces) {
    cleaned += '}'.repeat(openBraces - closeBraces);
  }
  if (openBrackets > closeBrackets) {
    cleaned += ']'.repeat(openBrackets - closeBrackets);
  }

  return cleaned;
}

function extractJSON(text: string): string {
  // 1. 从 markdown code fence 中提取
  const fence = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fence && fence[1]) {
    const inner = fence[1].trim();
    if (inner.startsWith('{') || inner.startsWith('[')) return inner;
  }
  // 2. 找第一个 { 和匹配的 }
  const brace = text.indexOf('{');
  if (brace >= 0) {
    let depth = 0;
    for (let i = brace; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) return text.slice(brace, i + 1);
      }
    }
  }
  // 3. 移除所有 markdown 标记后再试
  const cleaned = text.replace(/```[a-z]*\s*/gi, '').replace(/```/g, '').trim();
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) return cleaned;
  return text;
}

// ========== 分析身体数据 ==========
export async function analyzeBodyProfile(apiKey: string, profile: BodyProfile): Promise<BodyAnalysis> {
  const systemPrompt = `你是注册营养师。根据输入数据精确计算并返回JSON。

公式：
- BMI = 体重kg/(身高m)²，保留1位
- BMR = Mifflin-St Jeor（男:10×体重+6.25×身高-5×年龄+5，女:10×体重+6.25×身高-5×年龄-161）
- TDEE = BMR×1.375
- targetCalories：减脂=TDEE-400，增肌=TDEE+350，维持=TDEE
- macroSplit(g)：减脂→蛋白2.2g/kg,脂肪≥0.8g/kg,碳水补剩余；增肌→蛋白1.8g/kg,脂肪≥1g/kg,碳水补剩余；维持→蛋白1.6g/kg,脂肪≥0.8g/kg,碳水补剩余
- estimatedDaysToGoal = |目标体重-当前体重|÷0.6(周速)×7
- weeklyWeightChange：每周体重变化kg(保留1位)
- summary：3-5句中文建议

返回JSON格式：{"bmi":0,"bmr":0,"tdee":0,"targetCalories":0,"macroSplit":{"protein":0,"carbs":0,"fat":0},"estimatedDaysToGoal":0,"weeklyWeightChange":0,"summary":""}`;

  const diff = profile.targetWeight - profile.weight;
  const weightDir = diff > 0 ? '增重' : diff < 0 ? '减重' : '维持';

  const userMsg = `性别${profile.gender==='male'?'男':'女'} 年龄${profile.age} 身高${profile.height}cm 体重${profile.weight}kg→目标${profile.targetWeight}kg(${weightDir}${Math.abs(diff).toFixed(1)}kg) 体脂${profile.bodyFat}% 目标${profile.goal==='cut'?'减脂':profile.goal==='bulk'?'增肌':'维持'} 饮食${profile.dietMethod} 烹饪${profile.cookingPreference==='cook'?'开火':'不开火'}`;

  const response = await callDeepSeek(apiKey, systemPrompt, userMsg, { jsonMode: true });
  const json = extractJSON(response);
  try {
    return JSON.parse(repairJSON(json)) as BodyAnalysis;
  } catch (e: any) {
    throw new Error(`身体数据分析失败：${e.message}`);
  }
}

// ========== 搜索食材营养信息 ==========
export async function searchFoodNutrition(apiKey: string, foodNames: string[]): Promise<{
  results: Array<{ name: string; brand: string; category: string; nutrition: { calories: number; protein: number; carbs: number; fat: number; fiber: number; caffeine?: number }; bestMealTime: string[]; isDrink: boolean; drinkType: string; imageUrl: string; notes: string }>;
}> {
  const systemPrompt = `食品营养数据库专家。返回JSON分析食材(每100g/ml)。

饮品识别：茶叶→drink/tea，咖啡→drink/coffee，花草茶(菊花/枸杞/玫瑰等)→drink/herbal，冲剂(蛋白粉/代餐粉等)→drink/supplement_drink

返回：{"results":[{"name":"","brand":"","category":"protein|carb|fat|vegetable|fruit|dairy|drink|other","nutrition":{"calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"caffeine":0},"bestMealTime":["breakfast"],"isDrink":false,"drinkType":"tea|coffee|herbal|supplement_drink|other_drink|none","imageUrl":"","notes":""}]}`;

  const response = await callDeepSeek(apiKey, systemPrompt, `分析：${foodNames.join('、')}`, { jsonMode: true });
  const json = extractJSON(response);
  try {
    return JSON.parse(repairJSON(json));
  } catch (e: any) {
    throw new Error(`食材分析失败：${e.message}`);
  }
}

// ========== 解析购买链接 ==========
export async function parsePurchaseLink(apiKey: string, link: string): Promise<{ name: string; brand: string; estimatedQuantity: number; unit: string; category: string; isDrink: boolean; notes: string }> {
  const systemPrompt = `电商商品提取。支持淘宝/京东/拼多多/抖音/1688/小红书/美团等链接。

返回JSON：{"name":"产品名","brand":"品牌","estimatedQuantity":数量(默认1),"unit":"g/个/袋/瓶/盒/包","category":"protein|carb|fat|vegetable|fruit|dairy|drink|other|unknown","isDrink":false,"notes":""}
饮品/茶叶/咖啡/冲剂类isDrink=true,category="drink"。无法识别name="未知商品"。`;

  const response = await callDeepSeek(apiKey, systemPrompt, link, { jsonMode: true, maxTokens: 1024 });
  const json = extractJSON(response);
  try {
    return JSON.parse(repairJSON(json));
  } catch (e: any) {
    throw new Error(`链接解析失败：${e.message}`);
  }
}

// ========== 生成一周食谱 ==========
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
  const regularItems = pantry.filter(p => !p.priority && (p.remainingQuantity ?? p.totalQuantity) > 0);
  const drinkItems = pantry.filter(p => p.isDrink || p.category === 'drink');
  const allItems = [...priorityItems, ...regularItems];

  // 食材描述（精简）
  const pantryList = allItems.map(p => {
    const prio = p.priority ? '⚡' : '';
    const nut = p.nutrition ? `${p.nutrition.calories}kcal P${p.nutrition.protein}g C${p.nutrition.carbs}g F${p.nutrition.fat}g` : '未分析';
    const drink = p.isDrink ? ` 🍵${p.drinkType||'饮品'}` : '';
    return `[${p.id}] ${prio}${p.name} ${p.brand||''} | ${nut} | ${p.remainingQuantity??p.totalQuantity}${p.unit}${drink}`;
  }).join('\n');

  // 外卖列表（精简）
  const takeoutList = hasTakeout
    ? takeoutDishes.map(d => `[${d.id}]${d.name}(${d.restaurant}) ${d.nutrition.calories}kcal P${d.nutrition.protein}g C${d.nutrition.carbs}g F${d.nutrition.fat}g`).join('\n')
    : '';

  // 保健品列表（精简）
  const suppList = hasSupp
    ? supplements.map(s => `[${s.id}]${s.name}(${s.brand}) ${s.dosage}`).join('\n')
    : '';

  // ====== 组装精简但完整的系统提示词 ======
  const systemPrompt = `你是一位资深注册营养师(RD)，精通营养时序、代谢调控、营养协同与补充剂科学。

🔥 核心规则：
1. 每天4餐：breakfast/lunch/dinner/snack。日热量±80kcal
2. 营养时序：早→高蛋白+碳水,午→均衡+蔬菜,晚→低碳水+高蛋白,加餐→蛋白+少量碳/脂。晚餐碳水≤全天25%，睡前3h完成
3. 营养协同：维C+铁↑,脂溶维生素需配脂肪,钙铁分服(≥2h),蛋白≥25g/餐
4. 中式饮食，一周≥25种食材

⚡ 优先消耗食材（排在前3天集中使用）：
${priorityItems.length > 0 ? priorityItems.map(p => `${p.name}(余${p.remainingQuantity??p.totalQuantity}${p.unit})`).join('、') : '无'}

🍵 饮品清单（安排进每日饮水时间表）：
${drinkItems.length > 0 ? drinkItems.map(d => `${d.name}(${d.drinkType||'饮品'},余${d.remainingQuantity??d.totalQuantity}${d.unit})`).join('、') : '按标准饮水推荐'}

💊 保健品（自动决定最佳服用时机）：
${hasSupp ? supplements.map(s => `${s.name} ${s.dosage}`).join('、') : '无'}
- 脂溶维生素(A/D/E/K)随含脂餐, 维C随早/午餐, B族早随餐, 铁剂早后1h+维C, 钙随晚, 镁睡前, 锌随餐, 鱼油随含脂餐, 益生菌空腹, 蛋白粉运动后

🛵 ${isNoCook ? `烹饪方式：只选外卖/即食/冲泡/生食/微波。外卖从以下库选：
${takeoutList}` : '可开火：煎蒸煮炒烤焖炖凉拌生食微波'}
${isCarbCycle ? '碳循环：高碳(碳水≥50%,2天)→中碳(30-40%,2天)→低碳(≤20%,2天)→无碳(<30g,1天)，不连续同类型' : ''}

📤 返回JSON（必须返回完整合法的JSON，不要省略任何字段）：
{
  "days": [
    {
      "day": "monday",
      "meals": {
        "breakfast": [{"name":"","amount":"","calories":0,"protein":0,"carbs":0,"fat":0,"cookingMethod":"","fromPantry":false,"pantryItemId":"","pantryItemName":"","isSupplement":false}],
        "lunch": [],
        "dinner": [],
        "snack": []
      },
      "dailyTotals": {"calories":0,"protein":0,"carbs":0,"fat":0},
      ${isCarbCycle ? '"carbCyclePhase":"",' : ''}
      "cookingNote": "",
      ${hasSupp ? '"supplements": [{"supplementId":"","name":"","timing":"before_meal|with_meal|after_meal","meal":"breakfast|lunch|dinner|snack"}],' : ''}
      "waterIntake": {"totalMl": 0, "schedule": [{"time":"00:00","amountMl":0,"drinkName":"","note":""}]}
    }
  ],
  "pantryUsageSummary": [{"pantryItemId":"","name":"","usedPerWeek":0,"remainingWeeks":0,"daysToEmpty":0}],
  "totalDaysToGoal": 0,
  "waterOverview": ""
}

每道菜必须填cookingMethod。fromPantry=true必须填pantryItemId。waterIntake每天必含5-8条schedule。` + (isCarbCycle ? '每天必填carbCyclePhase。' : '') + (hasSupp ? '每天必含supplements数组。' : '');

  const diff = profile.targetWeight - profile.weight;

  const userMsg = `用户：${profile.gender==='male'?'男':'女'} ${profile.age}岁 ${profile.height}cm ${profile.weight}→${profile.targetWeight}kg(需${diff>0?'增':diff<0?'减':'维持'}${Math.abs(diff).toFixed(1)}kg) 体脂${profile.bodyFat}% 目标${profile.goal==='cut'?'减脂':profile.goal==='bulk'?'增肌':'维持'} ${profile.dietMethod} ${isNoCook?'不开火':'开火'}
每日目标：${analysis.targetCalories}kcal P${analysis.macroSplit.protein}g C${analysis.macroSplit.carbs}g F${analysis.macroSplit.fat}g

已有食材：
${pantryList || '无'}

${priorityItems.length > 0 ? '⚠️ 以上标记⚡的食材必须在前3天集中消耗！' : ''}
${drinkItems.length > 0 ? '🍵 饮品安排进每日饮水schedule。' : ''}
${hasSupp ? '💊 按规则自动配给保健品。' : ''}

请输出完整JSON（7天×4餐，所有字段不可省略）。`;

  const response = await callDeepSeek(apiKey, systemPrompt, userMsg, { jsonMode: true });
  const extracted = extractJSON(response);
  try {
    const plan = JSON.parse(repairJSON(extracted)) as WeeklyMealPlan;
    plan.generatedAt = Date.now();
    return plan;
  } catch (parseErr: any) {
    const preview = response.slice(0, 400) + '\n...\n' + response.slice(-300);
    throw new Error(`食谱JSON解析失败：${parseErr.message}\n\nAI返回预览：\n${preview}`);
  }
}
