import type { BodyProfile, BodyAnalysis, PantryItem, Supplement, TakeoutDish, WeeklyMealPlan } from '../types';

const API_BASE = 'https://api.deepseek.com';
const MODEL = 'deepseek-chat';

async function chat(apiKey: string, system: string, user: string, maxTokens = 2048): Promise<string> {
  const res = await fetch(`${API_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`DeepSeek API (${res.status}): ${err.slice(0, 300)}`); }
  const data = await res.json();
  if (data.choices[0].finish_reason === 'length') {
    throw new Error('AI 输出被截断（token 不足），已自动增加，请重试。');
  }
  return data.choices[0].message.content;
}

function parseAIResponse<T>(raw: string, label: string): T {
  const head = raw.slice(0, 200);
  const tail = raw.length > 200 ? raw.slice(-100) : '';
  // 暴力去反引号
  let text = raw.replace(/`/g, '');
  // 括号追踪找最外层 JSON
  const start = text.indexOf('{');
  if (start === -1) throw new Error(`${label}: 未找到 JSON\n原始(前200): ${head}`);

  let depth = 0; let end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }

  let json = '';
  if (end === -1) {
    json = text.slice(start);
    let b = 0, k = 0;
    for (const ch of json) { if (ch === '{') b++; else if (ch === '}') b--; else if (ch === '[') k++; else if (ch === ']') k--; }
    if (b > 0) json += '}'.repeat(b);
    if (k > 0) json += ']'.repeat(k);
  } else {
    json = text.slice(start, end + 1);
  }

  json = json.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/,\s*,/g, ',').replace(/:\s*undefined/g, ':null').replace(/:\s*NaN/g, ':null');

  try { return JSON.parse(json) as T; } catch (e1: any) {
    // brute force repair
    const out: string[] = []; let inStr = false; let prev = ''; let i = 0;
    while (i < json.length) {
      const ch = json[i];
      if (ch === '"' && prev !== '\\') inStr = !inStr;
      if (inStr) {
        if (ch === '\\' && i + 1 < json.length && !'"\\/bfnrtu'.includes(json[i + 1])) { out.push(json[i + 1]); i += 2; prev = ch; continue; }
        out.push(ch);
      } else {
        if (ch !== '\n' && ch !== '\r') out.push(ch);
      }
      prev = ch; i++;
    }
    let result = out.join('');
    let b = 0, k = 0; for (const ch of result) { if (ch === '{') b++; else if (ch === '}') b--; else if (ch === '[') k++; else if (ch === ']') k--; }
    while (b > 0) { result += '}'; b--; } while (k > 0) { result += ']'; k--; }
    try { return JSON.parse(result) as T; } catch (e2: any) {
      throw new Error(`${label} 解析失败:\n步骤1: ${e1.message}\n步骤2: ${e2.message}\n\n原始前200: ${head}\n原始后100: ${tail}\n提取JSON前200: ${json.slice(0, 200)}`);
    }
  }
}

// ==================== 1. 分析身体数据 ====================
export async function analyzeBodyProfile(apiKey: string, profile: BodyProfile): Promise<BodyAnalysis> {
  const system = `你是注册营养师。严格按公式计算并只返回 JSON。公式：BMI=体重/(身高m)²(1位)；BMR(Mifflin-St Jeor): 男=10×体重+6.25×身高-5×年龄+5, 女=10×体重+6.25×身高-5×年龄-161；TDEE=BMR×1.375；targetCal: 减脂=TDEE-400,增肌=TDEE+350,维持=TDEE；protein(g): 减脂2.2×体重,增肌1.8×体重,维持1.6×体重；fat(g): max(0.8×体重,总热量×0.2÷9)；carbs(g): (targetCal-protein×4-fat×9)÷4；estimatedDaysToGoal: |目标-当前|÷0.6×7；weeklyWeightChange(1位,正增负减)；summary: 3句中文建议。{"bmi":0,"bmr":0,"tdee":0,"targetCalories":0,"macroSplit":{"protein":0,"carbs":0,"fat":0},"estimatedDaysToGoal":0,"weeklyWeightChange":0,"summary":""}`;

  const diff = profile.targetWeight - profile.weight;
  const user = `${profile.gender==='male'?'男':'女'}${profile.age}岁${profile.height}cm${profile.weight}→${profile.targetWeight}kg(${diff>0?'增':diff<0?'减':'维持'}${Math.abs(diff).toFixed(1)}) 体脂${profile.bodyFat}% ${profile.goal} ${profile.dietMethod} ${profile.cookingPreference}`;

  const raw = await chat(apiKey, system, user, 1024);
  return parseAIResponse<BodyAnalysis>(raw, '身体数据分析');
}

// ==================== 2. 食材营养查询 ====================
export async function searchFoodNutrition(apiKey: string, foods: string[]): Promise<{
  results: Array<{ name: string; brand: string; category: string; nutrition: { calories: number; protein: number; carbs: number; fat: number; fiber: number; caffeine?: number }; bestMealTime: string[]; isDrink: boolean; drinkType: string; imageUrl: string; notes: string }>;
}> {
  const system = `食品营养专家。只返回JSON。饮品:茶叶→drink/tea,咖啡→drink/coffee,花草茶(菊花/枸杞/玫瑰等)→drink/herbal,冲剂(蛋白粉/代餐粉/电解质等)→drink/supplement_drink。每100g/ml。caffeine mg/100ml(绿茶30,红茶40,乌龙25,普洱20,花草茶0)。{"results":[{"name":"","brand":"","category":"protein|carb|fat|vegetable|fruit|dairy|drink|other","nutrition":{"calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"caffeine":0},"bestMealTime":["breakfast"],"isDrink":false,"drinkType":"tea|coffee|herbal|supplement_drink|other_drink|none","imageUrl":"","notes":""}]}`;

  const raw = await chat(apiKey, system, `分析: ${foods.join('、')}`, 4096);
  return parseAIResponse(raw, '食材分析');
}

// ==================== 3. 购买链接解析 ====================
export async function parsePurchaseLink(apiKey: string, link: string): Promise<{ name: string; brand: string; estimatedQuantity: number; unit: string; category: string; isDrink: boolean; notes: string }> {
  const system = `电商商品提取。支持淘宝/京东/拼多多/抖音/1688/小红书/美团等。{"name":"产品名","brand":"品牌(不可知则'通用')","estimatedQuantity":1,"unit":"g/个/袋/瓶/盒/包/罐","category":"protein|carb|fat|vegetable|fruit|dairy|drink|other|unknown","isDrink":false,"notes":""} 饮品/茶/咖啡/冲剂isDrink=true,category="drink"。无法识别name="未知商品"。`;

  const raw = await chat(apiKey, system, link, 1024);
  return parseAIResponse(raw, '链接识别');
}

// ==================== 常用食物数据库 ====================
const FOOD_DB = `你作为注册营养师，请参考以下食物数据（每份）来填写每道菜的 calories/protein/carbs/fat：

早餐: 煮鸡蛋(1个) 80kcal P7 C1 F6 | 煎蛋(1个) 90kcal P7 C1 F7 | 水煮蛋(2个) 160kcal P14 C2 F12 | 全麦面包(2片) 180kcal P8 C35 F3 | 白粥(1碗) 100kcal P2 C23 F0 | 小米粥(1碗) 120kcal P3 C25 F1 | 燕麦片50g干(煮后) 190kcal P7 C33 F3 | 豆浆300ml 90kcal P8 C6 F3 | 牛奶250ml 130kcal P8 C12 F7 | 酸奶200g 140kcal P7 C20 F4 | 菜包(2个) 240kcal P8 C44 F4 | 肉包(2个) 300kcal P14 C44 F10 | 花卷(1个) 180kcal P5 C38 F2 | 蒸饺(6个) 280kcal P10 C40 F10 | 小馄饨(1碗) 250kcal P10 C32 F10

蛋白: 鸡胸肉150g 195kcal P37 C1 F5 | 鸡腿去皮1只 180kcal P28 C0 F8 | 猪瘦肉100g 143kcal P20 C2 F6 | 猪里脊100g 132kcal P21 C0 F5 | 瘦牛肉100g 125kcal P22 C3 F3 | 牛腱子100g 155kcal P28 C1 F4 | 虾仁100g 95kcal P21 C1 F1 | 巴沙鱼150g 195kcal P33 C1 F8 | 三文鱼100g 208kcal P20 C0 F13 | 草鱼100g 140kcal P18 C0 F7 | 豆腐200g 152kcal P16 C6 F8 | 老豆腐150g 183kcal P20 C4 F11 | 豆干100g 140kcal P16 C4 F9

主食: 白米饭1碗 240kcal P4 C53 F1 | 杂粮饭1碗 220kcal P6 C48 F2 | 馒头1个 220kcal P7 C48 F1 | 红薯200g 172kcal P3 C40 F1 | 土豆200g 154kcal P4 C34 F1 | 玉米1根 120kcal P4 C28 F1 | 荞麦面100g干 360kcal P12 C70 F3 | 全麦意面100g干 355kcal P14 C71 F2 | 糙米饭1碗 230kcal P5 C50 F2

蔬菜: 西兰花200g 68kcal P6 C12 F1 | 菠菜200g 56kcal P6 C8 F2 | 番茄1个 25kcal P1 C6 F0 | 黄瓜1根 16kcal P1 C3 F0 | 青椒2个 40kcal P2 C9 F1 | 胡萝卜1根 50kcal P1 C12 F0 | 香菇100g 38kcal P3 C7 F1 | 生菜100g 14kcal P1 C3 F0 | 娃娃菜200g 30kcal P3 C5 F1 | 紫甘蓝100g 25kcal P1 C6 F0 | 木耳干5g泡发 13kcal P1 C3 F0 | 四季豆150g 47kcal P3 C9 F1

油脂: 橄榄油1勺 120kcal P0 C0 F14 | 花生油1勺 120kcal P0 C0 F14 | 杏仁15粒 105kcal P4 C4 F9 | 核桃3个 140kcal P3 C3 F14 | 牛油果半个 160kcal P2 C9 F15

水果: 苹果1个 95kcal P1 C25 F0 | 香蕉1根 105kcal P1 C27 F0 | 橙子1个 60kcal P1 C15 F0 | 蓝莓100g 57kcal P1 C14 F0 | 奇异果1个 42kcal P1 C10 F0 | 葡萄200g 130kcal P1 C34 F0 | 草莓100g 32kcal P1 C7 F0 | 火龙果半个 110kcal P1 C27 F0

上表没有的食物，按你作为营养师的真实知识填写，但必须写真实厨艺做法（煎/蒸/煮/炒/烤/焖/炖/凉拌），不是“冲泡”（除非确实是冲泡食品）。`;

// ==================== 4. 生成一周食谱 ====================
export async function generateMealPlan(
  apiKey: string,
  profile: BodyProfile,
  analysis: BodyAnalysis,
  pantry: PantryItem[],
  supplements: Supplement[] = [],
  takeoutDishes: TakeoutDish[] = [],
): Promise<WeeklyMealPlan> {
  const isNoCook = profile.cookingPreference === 'nocook';
  const isCarbCycle = profile.dietMethod === 'carb-cycle';
  const hasSupp = supplements.length > 0;
  const hasTakeout = takeoutDishes.length > 0;

  const priorityItems = pantry.filter(p => p.priority && (p.remainingQuantity ?? p.totalQuantity) > 0);
  const drinkItems = pantry.filter(p => p.isDrink || p.category === 'drink');
  const allItems = [...priorityItems, ...pantry.filter(p => !p.priority)];

  const goalCals = analysis.targetCalories;
  const goalP = analysis.macroSplit.protein;
  const goalC = analysis.macroSplit.carbs;
  const goalF = analysis.macroSplit.fat;

  // 食材描述
  const pantryStr = allItems.length > 0
    ? allItems.map(p => {
        const prio = p.priority ? '⚡' : '';
        const nut = p.nutrition ? `${p.nutrition.calories}kcal/100g P${p.nutrition.protein} C${p.nutrition.carbs} F${p.nutrition.fat}` : '未分析';
        return `[${p.id}] ${prio}${p.name}|${nut}|余${p.remainingQuantity??p.totalQuantity}${p.unit}${p.isDrink?'🍵':''}`;
      }).join('; ')
    : '无';

  const takeoutStr = hasTakeout
    ? takeoutDishes.map(d => `[${d.id}]${d.name}(${d.restaurant})${d.nutrition.calories}kcal`).join('; ')
    : '';

  // ====== 构建 system prompt ======
  const parts: string[] = [];

  parts.push(`你是一位中国注册营养师。基于食物营养数据库为用户生成7天、每天4餐(breakfast/lunch/dinner/snack)的个性化饮食计划。只返回JSON。`);
  parts.push(FOOD_DB);

  // 目标和硬约束
  parts.push(`【硬性约束】
- 日热量≈${goalCals}kcal ±100 | 日蛋白≈${goalP}g ±12 | 日碳水≈${goalC}g ±12 | 日脂肪≈${goalF}g ±8
- 早餐 400-550kcal: 高蛋白+优质碳水+1份蔬菜
- 午餐 550-700kcal: 均衡(蛋白+碳水+2-3份蔬菜+少量健康油脂)
- 晚餐 350-500kcal: 高蛋白+2-3份大量蔬菜+低碳水主食(或不吃主食), 睡前3h完成
- 加餐 100-200kcal: 蛋白零食/水果/坚果/酸奶
- 每餐至少2道不同食物，绝不允许一餐只有一样东西`);

  // 品种和真实性——这是关键
  parts.push(`【品种&真实性——极其重要，每次生成必须不同】
- 7天至少30种不同食物名。主食7天内至少变换4-5种(米饭/馒头/杂粮饭/红薯/玉米/面条/荞麦面必须轮换)
- 同一主食一周最多用3次，同一肉类一周最多用2-3次
- 绝不允许整天吃同一种食材(如三餐都是豆制品的食谱不合格——这是严重错误)
- 每天每餐的食物组成必须明显不同，绝不能有两天完全相同
- 非库存食材要写真实烹饪方式：炒/煎/蒸/煮/烤/焖/炖/凉拌/卤
- 只有本来就是冲泡类的(蛋白粉/代餐粉/燕麦片/豆浆粉等)才能写"冲泡"`);

  // 优先消耗
  if (priorityItems.length > 0) {
    parts.push(`【⚡优先消耗——前3天集中用】
${priorityItems.map(p => `${p.name}(余${p.remainingQuantity??p.totalQuantity}${p.unit},每100g: ${p.nutrition ? `${p.nutrition.calories}kcal P${p.nutrition.protein}C${p.nutrition.carbs}F${p.nutrition.fat}` : '未分析'})`).join('; ')}
这些优先食材在前3天至少用掉总量的70%。fromPantry=true, pantryItemId/pantryItemName必填。`);
  }

  // 饮水
  if (drinkItems.length > 0) {
    parts.push(`【🍵饮水】每天waterIntake含5-8条schedule。已有茶饮: ${drinkItems.map(d=>d.name).join('、')}。含咖啡因的上午10点前喝完(不晚于下午2点)，花草草本全天。总咖啡因<400mg/天。`);
  } else {
    parts.push('【🍵饮水】每天waterIntake含5-8条schedule，总饮水2-2.5L。');
  }

  // 保健品
  if (hasSupp) {
    parts.push(`【💊保健品——你作为营养师决定最佳服用时机】
${supplements.map(s=>`${s.name} (${s.brand}) ${s.dosage}`).join('; ')}
服用原则: 脂溶维生素(A/D/E/K)随含脂正餐 | 维C随早/午(避免空腹刺激胃) | B族早随餐 | 铁剂早后1h+维C(与钙隔≥2h) | 钙随晚(夜间利用最高) | 镁睡前 | 锌随餐(不跟钙铁) | 鱼油随含脂餐 | 益生菌空腹/睡前 | 蛋白粉运动后30min | 每天supplements数组必含全部`);
  }

  // 烹饪方式
  if (isNoCook) {
    parts.push(`【🛵不开火】只选: 外卖/即食/生食/微波/冲泡${hasTakeout?'。外卖库(从这选，不重复): '+takeoutStr:''}`);
  } else {
    parts.push('【🍳开火】烹饪方式: 煎/蒸/煮/炒/烤/焖/炖/凉拌/卤。');
  }

  // 碳循环
  if (isCarbCycle) {
    const highC = Math.round(goalCals * 0.50 / 4);
    const medC  = Math.round(goalCals * 0.35 / 4);
    const lowC  = Math.round(goalCals * 0.15 / 4);
    const noC   = Math.round(30 / 4);
    const highF  = Math.round((goalCals - goalP * 4 - highC * 4) / 9);
    const medF   = Math.round((goalCals - goalP * 4 - medC  * 4) / 9);
    const lowF   = Math.round((goalCals - goalP * 4 - lowC  * 4) / 9);
    const noF    = Math.round((goalCals - goalP * 4 - noC   * 4) / 9);

    parts.push(`【🔄碳循环——严格按此顺序, carbCyclePhase不许改】
Mon 高碳日 "high-carb"    碳水≈${highC}g  脂肪≈${highF}g  多米饭/面+鸡/鱼肉,少油
Tue 高碳日 "high-carb"    碳水≈${highC}g  脂肪≈${highF}g  多米饭/面+鸡/鱼肉,少油
Wed 中碳日 "medium-carb"  碳水≈${medC}g   脂肪≈${medF}g   粗粮+鸡/牛/鱼肉
Thu 中碳日 "medium-carb"  碳水≈${medC}g   脂肪≈${medF}g   粗粮+鸡/牛/鱼肉
Fri 低碳日 "low-carb"     碳水≈${lowC}g   脂肪≈${lowF}g   不吃米面,吃紫薯/玉米+猪肉/牛肉
Sat 低碳日 "low-carb"     碳水≈${lowC}g   脂肪≈${lowF}g   不吃米面,吃紫薯/玉米+猪肉/牛肉
Sun 无碳日 "no-carb"      碳水<${noC}g    脂肪≈${noF}g    仅蔬菜纤维,大量肉蛋+蔬菜+牛油果`);
  }

  // ====== JSON 格式 ======
  const mealEx = '{"name":"西兰花炒鸡胸肉","amount":"200g西兰花+150g鸡胸肉","calories":263,"protein":43,"carbs":13,"fat":6,"cookingMethod":"炒","fromPantry":false,"pantryItemId":"","pantryItemName":"","isSupplement":false}';
  const suppField = hasSupp ? '"supplements":[{"supplementId":"","name":"","timing":"before_meal|with_meal|after_meal","meal":"breakfast|lunch|dinner|snack"}],' : '';
  const watEx = '"waterIntake":{"totalMl":2400,"schedule":[{"time":"07:30","amountMl":300,"drinkName":"温水","note":"起床唤醒"},{"time":"10:00","amountMl":400,"drinkName":"绿茶","note":"提神"},{"time":"12:30","amountMl":300,"drinkName":"温水","note":"餐后"},{"time":"15:00","amountMl":300,"drinkName":"枸杞水","note":"下午补水"},{"time":"18:00","amountMl":300,"drinkName":"温水","note":"餐后"},{"time":"20:00","amountMl":300,"drinkName":"菊花茶","note":"放松"}]}';

  parts.push(`【JSON格式】
每道菜格式(必须): ${mealEx}
⚠️ calories/protein/carbs/fat 必须按上表食物数据库中对应份量的真实数字填写，不要抄这个例子里的263/43/13/6！
非库存食材 fromPantry=false, pantryItemId="", pantryItemName="" (不填也不写库存食材的id)
库存食材 fromPantry=true, pantryItemId填对应食材id, pantryItemName填食材名

JSON骨架（7天完整展开，food name和nutrition数字替换为你创作的；第二天~第七天的meals array要一个个填满不能省略）:
{"days":[
{"day":"monday",${isCarbCycle?'"carbCyclePhase":"high-carb",':''}"meals":{"breakfast":[],"lunch":[],"dinner":[],"snack":[]},"dailyTotals":{"calories":0,"protein":0,"carbs":0,"fat":0},"cookingNote":"${isCarbCycle?'高碳':'均衡'}日",${suppField}${watEx}},
{"day":"tuesday",${isCarbCycle?'"carbCyclePhase":"high-carb",':''}"meals":{"breakfast":[],"lunch":[],"dinner":[],"snack":[]},"dailyTotals":{...},"cookingNote":"${isCarbCycle?'高碳':'均衡'}日",${suppField}"waterIntake":{...}},
{"day":"wednesday",${isCarbCycle?'"carbCyclePhase":"medium-carb",':''}"meals":{...},"dailyTotals":{...},${suppField}"waterIntake":{...}},
{"day":"thursday","meals":{...},"dailyTotals":{...}},
{"day":"friday","meals":{...},"dailyTotals":{...}},
{"day":"saturday","meals":{...},"dailyTotals":{...}},
{"day":"sunday","meals":{...},"dailyTotals":{...}}
],"pantryUsageSummary":[{"pantryItemId":"","name":"","usedPerWeek":0,"remainingWeeks":0,"daysToEmpty":0}],"totalDaysToGoal":${analysis.estimatedDaysToGoal},"waterOverview":""}

最后提醒:
- 7天必须全部展开，每个meal array至少填满2-3道菜
- dailyTotals含所有菜的营养求和(不含保健品)。填真实和值，不要填0。`);

  const diff = profile.targetWeight - profile.weight;

  const user = `${profile.gender==='male'?'男':'女'} ${profile.age}岁 ${profile.height}cm ${profile.weight}→${profile.targetWeight}kg(需${diff>0?'增':diff<0?'减':'维持'}${Math.abs(diff).toFixed(1)}kg) 体脂${profile.bodyFat}%

已有食材: ${pantryStr}
${priorityItems.length>0?'⚠️⚡优先食材前3天用完70%！':''}
${drinkItems.length>0?'🍵饮品需入饮水schedule。':''}
${hasSupp?'💊保健品每天全配。':''}
${isCarbCycle?'🔄碳循环: 碳水必须按高→高→中→中→低→低→无顺序递减，每个dailyTotals.carbs必须符合！':''}

输出完整7天JSON。`;

  const systemPrompt = parts.join('\n\n');
  const raw = await chat(apiKey, systemPrompt, user, 16384);

  const plan = parseAIResponse<WeeklyMealPlan>(raw, '食谱生成');
  plan.generatedAt = Date.now();

  // ====== 代码级重算 dailyTotals ======
  for (const day of plan.days) {
    let sCal = 0, sP = 0, sC = 0, sF = 0;
    for (const slot of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
      for (const e of (day.meals[slot] || [])) {
        if (!e.isSupplement) {
          sCal += Number(e.calories) || 0;
          sP   += Number(e.protein) || 0;
          sC   += Number(e.carbs)   || 0;
          sF   += Number(e.fat)     || 0;
        }
      }
    }
    day.dailyTotals = { calories: Math.round(sCal), protein: Math.round(sP), carbs: Math.round(sC), fat: Math.round(sF) };
  }

  // ====== 品种校验 ======
  const allNames = new Set<string>();
  for (const day of plan.days) {
    for (const slot of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
      for (const e of (day.meals[slot] || [])) {
        if (!e.isSupplement && e.name) allNames.add(e.name);
      }
    }
  }
  if (allNames.size < 20) {
    throw new Error(`品种不足！仅${allNames.size}种不同食物（需要≥20种）。请点击「重新生成」重试。`);
  }

  // ====== 重复日检测 ======
  const dayHashes = plan.days.map(d => {
    const names: string[] = [];
    for (const slot of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
      for (const e of (d.meals[slot] || [])) { if (!e.isSupplement) names.push(e.name); }
    }
    return names.sort().join(',');
  });
  const uniqueDays = new Set(dayHashes).size;
  if (uniqueDays < 5) {
    throw new Error(`重复天数太多！7天中只有${uniqueDays}天不同（需要≥5天不同）。请点击「重新生成」重试。`);
  }

  // ====== 碳循环校验 ======
  if (isCarbCycle) {
    const phases = plan.days.map(d => d.carbCyclePhase);
    const req = ['high-carb', 'high-carb', 'medium-carb', 'medium-carb', 'low-carb', 'low-carb', 'no-carb'];
    if (phases.some((p, i) => p !== req[i])) {
      throw new Error(`碳循环 phase 错误！要求: ${req.join('→')}  实际: ${phases.join('→')}`);
    }
    const carbs = plan.days.map(d => d.dailyTotals.carbs);
    const ha = (carbs[0]+carbs[1])/2, ma = (carbs[2]+carbs[3])/2, la = (carbs[4]+carbs[5])/2, nc = carbs[6];
    if (!(ha > ma && ma > la && la > nc)) {
      throw new Error(`碳水未递减！高碳平均=${ha}g 中碳=${ma}g 低碳=${la}g 无碳=${nc}g  请重试。`);
    }
  }

  return plan;
}
