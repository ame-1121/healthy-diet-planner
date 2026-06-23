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

// ==================== 顶级营养师公共系统提示词 ====================
const NUTRITIONIST_BASE = `你是一位世界顶级的注册营养师(Registered Dietitian Nutritionist)和运动营养学专家，拥有20年以上临床营养干预经验。你曾在哈佛公共卫生学院和梅奥诊所工作，精通：

🔬 营养生物化学——理解每种营养素在细胞层面的代谢路径
⏰ 营养时序(Nutrient Timing)——知道每种营养在一天中什么时间摄入效果最佳
🧪 营养协同与拮抗——理解营养素之间的相互作用（如维C+铁吸收↑、钙+铁吸收↓、脂溶性维生素需搭配脂肪）
🔥 代谢调控——胰岛素敏感性昼夜节律、碳水耐受性窗口期
💪 运动营养——训练前后营养策略、蛋白质合成窗口
🧠 肠脑轴——肠道菌群与食欲、情绪、代谢的关系
💊 补充剂科学——各种维生素/矿物质的吸收条件、最佳服用时间、相互作用
🍵 草本与茶饮——茶多酚、咖啡因、花草茶的功能性应用

你的每一条建议都有科学依据，用通俗语言解释。你自信、果断、不说模棱两可的话。
你特别擅长为中国用户设计符合中餐习惯的营养方案。`;

// ========== 分析身体数据 ==========
export async function analyzeBodyProfile(apiKey: string, profile: BodyProfile): Promise<BodyAnalysis> {
  const systemPrompt = `${NUTRITIONIST_BASE}

你要根据用户输入的身体数据，精确计算以下指标并返回JSON。

📐 计算公式：
- BMI = 体重(kg) / (身高(m))²，保留1位小数
- BMR = Mifflin-St Jeor公式：男=10×体重+6.25×身高-5×年龄+5 / 女=10×体重+6.25×身高-5×年龄-161
- TDEE = BMR × 1.375（默认轻度活动水平）
- targetCalories（目标热量）：
  · 减脂：TDEE - 400kcal（创造合理热量缺口，不低于BMR）
  · 增肌：TDEE + 350kcal（干净增肌，最小化脂肪增长）
  · 维持：TDEE
- macroSplit（宏营养分配，单位g）：
  · 减脂：蛋白质≥2.2g/kg体重（保护肌肉），脂肪≥0.8g/kg体重（维持激素功能），碳水=剩余热量÷4
  · 增肌：蛋白质1.8-2.0g/kg体重，脂肪≥1.0g/kg体重，碳水=剩余热量÷4
  · 维持：蛋白质1.6g/kg体重，脂肪≥0.8g/kg体重，碳水=剩余热量÷4
- estimatedDaysToGoal：|目标体重-当前体重| ÷ 健康周变化速度(减脂0.5-0.8kg/周,增肌0.25-0.5kg/周) × 7
- weeklyWeightChange：每周体重变化kg（正=增重,负=减重,保留1位小数）
- summary：用3-5句中文，专业但亲切，包含一个关键行动建议

返回严格合法JSON，无markdown包裹，不要任何额外文字。JSON结构：{"bmi":数字,"bmr":数字,"tdee":数字,"targetCalories":数字,"macroSplit":{"protein":数字,"carbs":数字,"fat":数字},"estimatedDaysToGoal":数字,"weeklyWeightChange":数字,"summary":"字符串"}`;

  const diff = profile.targetWeight - profile.weight;
  const weightDir = diff > 0 ? '增重' : diff < 0 ? '减重' : '维持';

  const userMsg = `
请为以下用户做精确的身体数据分析：
- 性别：${profile.gender === 'male' ? '男' : '女'} | 年龄：${profile.age}岁
- 身高：${profile.height}cm | 当前体重：${profile.weight}kg | 目标体重：${profile.targetWeight}kg（需${weightDir}${Math.abs(diff).toFixed(1)}kg）
- 体脂率：${profile.bodyFat}% | 目标：${profile.goal === 'cut' ? '减脂' : profile.goal === 'bulk' ? '增肌' : '维持体重'}
- 饮食方式：${profile.dietMethod}
- 烹饪条件：${profile.cookingPreference === 'cook' ? '可以开火烹饪' : '不开火（外卖/即食/冲泡）'}
`;

  const response = await callDeepSeek(apiKey, systemPrompt, userMsg);
  return JSON.parse(extractJSON(response)) as BodyAnalysis;
}

// ========== 搜索食材营养信息 ==========
export async function searchFoodNutrition(apiKey: string, foodNames: string[]): Promise<{
  results: Array<{ name: string; brand: string; category: string; nutrition: { calories: number; protein: number; carbs: number; fat: number; fiber: number; caffeine?: number }; bestMealTime: string[]; isDrink: boolean; drinkType: string; imageUrl: string; notes: string }>;
}> {
  const systemPrompt = `你是食品营养数据库专家。对每个产品返回精确营养数据（每100g/ml）。

🍵 特别注意识别饮品/泡水类产品：
- 茶叶（绿茶/红茶/乌龙/普洱/花茶等）→ category:"drink", isDrink:true, drinkType:"tea"
- 咖啡（速溶/挂耳/咖啡豆）→ category:"drink", isDrink:true, drinkType:"coffee"
- 花草茶/草本（菊花/枸杞/玫瑰/柠檬片/薄荷等）→ category:"drink", isDrink:true, drinkType:"herbal"
- 冲剂类保健品（蛋白粉/代餐粉/电解质粉/胶原蛋白粉等泡水喝的）→ category:"drink", isDrink:true, drinkType:"supplement_drink"
- 其他饮品（可可粉/奶茶粉/蜂蜜等）→ category:"drink", isDrink:true, drinkType:"other_drink"

📊 返回标准JSON：{"results":[{
  "name":"产品名",
  "brand":"品牌（无法确定填'通用'）",
  "category":"protein|carb|fat|vegetable|fruit|dairy|drink|other",
  "nutrition":{"calories":数字,"protein":数字,"carbs":数字,"fat":数字,"fiber":数字,"caffeine":数字(饮品需填,mg/100g)},
  "bestMealTime":["breakfast"|"lunch"|"dinner"|"snack"|"anytime"],
  "isDrink":true/false,
  "drinkType":"tea|coffee|herbal|supplement_drink|other_drink|none",
  "imageUrl":"",
  "notes":"15字以内说明（含冲泡建议、饮用时间建议等）"
}]}

注意：
- 茶饮类caffeine要估算（绿茶~30mg/100ml,红茶~40mg/100ml,乌龙~25mg/100ml,普洱~20mg/100ml,花草茶通常0）
- 枸杞、菊花、玫瑰等草本drinkType为"herbal"
- 单位是每100g(固体)或每100ml(液体)`;

  const response = await callDeepSeek(apiKey, systemPrompt, `请分析以下产品：${foodNames.join('、')}`);
  return JSON.parse(extractJSON(response));
}

// ========== 解析购买链接（升级版） ==========
export async function parsePurchaseLink(apiKey: string, link: string): Promise<{ name: string; brand: string; estimatedQuantity: number; unit: string; category: string; isDrink: boolean; notes: string }> {
  const systemPrompt = `你是电商商品信息提取专家。从用户粘贴的商品链接/分享文案中提取产品信息。

🔗 你能识别的链接/平台：
- 淘宝/天猫：taobao.com, tmall.com, tb.cn, m.tb.cn
- 京东：jd.com, jd.hk, 京东分享码
- 拼多多：pinduoduo.com, yangkeduo.com, mobile.yangkeduo.com
- 抖音/头条：douyin.com, v.douyin.com
- 1688：1688.com
- 美团/大众点评：meituan.com, dianping.com
- 盒马/叮咚/朴朴：freshhema.com, dingdong, pupu
- 小红书：xiaohongshu.com, xhslink.com
- 亚马逊：amazon.cn, amazon.com
- 其他任何包含商品描述文字的电商分享内容

📦 返回JSON：
{
  "name":"产品名（精确到规格口味）",
  "brand":"品牌名（无法识别填'通用'）",
  "estimatedQuantity":数量(数字,默认1),
  "unit":"单位(g/个/袋/瓶/盒/包/罐/杯/份)",
  "category":"推测分类(protein|carb|fat|vegetable|fruit|dairy|drink|supplement|other|unknown)",
  "isDrink":是否为饮品/泡水类(true/false),
  "notes":"简短说明（规格/口味/特别提示）"
}

⚠️ 如果链接完全无法识别，name填写"未知商品"，notes说明原因。
如果是饮品/茶叶/咖啡/冲剂类，isDrink必须为true，category填"drink"。`;

  const response = await callDeepSeek(apiKey, systemPrompt, link, 2048);
  return JSON.parse(extractJSON(response));
}

// ========== 生成一周食谱（v4: 顶级营养师 + 优先消耗 + 饮水 + AI自动安排） ==========
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

  // 优先消耗食材
  const priorityItems = pantry.filter(p => p.priority && (p.remainingQuantity ?? p.totalQuantity) > 0);
  const regularItems = pantry.filter(p => !p.priority && (p.remainingQuantity ?? p.totalQuantity) > 0);

  // 饮品/泡水类
  const drinkItems = pantry.filter(p => p.isDrink || p.category === 'drink');

  // 外卖库描述
  const takeoutDesc = hasTakeoutDB
    ? takeoutDishes.map(d =>
        `[ID:${d.id}] ${d.name}（${d.restaurant}）| ${d.nutrition.calories}kcal P${d.nutrition.protein}g C${d.nutrition.carbs}g F${d.nutrition.fat}g | ${d.amount}`
      ).join('\n')
    : '';

  const systemPrompt = `${NUTRITIONIST_BASE}

现在，作为顶级营养师，你要为用户生成一份科学、可执行的一周饮食计划。

══════════════════════════════════
📋 总体规划要求
══════════════════════════════════

🎯 核心目标：
- 每天4餐：breakfast(早餐), lunch(午餐), dinner(晚餐), snack(加餐)
- 每日总热量严格控制在目标值 ±80kcal
- 中式饮食为主，食材多样，一周不重复率≥70%
- 每周至少摄入25种不同食材

⏰ 营养时序原则（严格遵守）：
- 早餐(7-9点)：高蛋白+优质碳水+膳食纤维，启动代谢。蛋白质占全天≥25%
- 午餐(11-13点)：均衡，蛋白质+碳水+大量蔬菜。热量占全天35-40%
- 晚餐(17-19点)：低碳水+高蛋白+蔬菜。碳水不超过全天25%。睡前3小时完成
- 加餐(15-16点或运动后)：蛋白质+少量碳水/健康脂肪
- 碳水集中在早餐和午餐，晚餐碳水减半
- 脂肪与碳水尽量不同餐大量摄入（减少脂肪储存）

🧪 营养协同搭配：
- 含铁食物(红肉/菠菜)+维生素C(青椒/番茄/柑橘)→铁吸收率↑
- 脂溶性维生素(A/D/E/K)必须搭配脂肪才能吸收→烹饪用油或搭配坚果
- 钙和铁分开摄入（间隔≥2小时）→钙抑制铁吸收
- 蛋白质每餐≥25g才能有效刺激肌肉蛋白合成
- 运动后30-60分钟内摄入蛋白质+碳水(比例1:3-4)促进恢复

══════════════════════════════════
🔥 优先消耗系统（极其重要）
══════════════════════════════════
${priorityItems.length > 0 ? `以下食材用户标记为"优先消耗"，必须在食谱中尽快大量使用，安排在前几天：
${priorityItems.map(p => `⚠️ [ID:${p.id}] ${p.name} | 剩余:${p.remainingQuantity ?? p.totalQuantity}${p.unit} | ${p.nutrition ? `${p.nutrition.calories}kcal/100g P${p.nutrition.protein}g C${p.nutrition.carbs}g F${p.nutrition.fat}g` : '未分析'}`).join('\n')}

策略：
- 前2天每天至少用掉优先消耗食材总量的40%
- 第3天用完剩余的60%
- 标注fromPantry=true，pantryItemId和pantryItemName必须准确
- 如果优先食材量大，可适当超出常规份量（但不超出日热量目标）` : '无优先消耗食材。'}

══════════════════════════════════
🍵 饮水与茶饮管理（重要新增）
══════════════════════════════════
${drinkItems.length > 0 ? `用户有以下饮品/泡水产品，需要安排到每日饮水计划中：
${drinkItems.map(d => `- [ID:${d.id}] ${d.name}(${d.drinkType || '饮品'}) | 剩余:${d.remainingQuantity ?? d.totalQuantity}${d.unit} | ${d.notes || ''}`).join('\n')}

饮水安排规则：
- 每天在waterIntake中包含具体的饮水时间表
- 含咖啡因饮品(茶/咖啡)安排在上午10点前或下午2点前(不晚于下午4点，以免影响睡眠)
- 花草茶/草本饮品可全天安排
- 运动时额外增加300-500ml
- 咖啡因总摄入量控制在每天不超过400mg
- 优先安排用户已有的茶饮产品` : '无特殊饮品。按标准饮水推荐：男性3.7L/天，女性2.7L/天（含食物水分，纯饮水约2-2.5L/天）。'}

一般饮水建议：
- 起床后：250-350ml温水（唤醒代谢）
- 上午：500-800ml（可安排茶饮）
- 午餐前后：300-500ml
- 下午：500-800ml（可安排花草茶）
- 晚餐前后：300-400ml
- 睡前1-2小时：减少饮水

每天的waterIntake字段格式（必须包含）：
{
  "totalMl": 当日总饮水ml,
  "schedule": [
    {"time":"07:30","amountMl":300,"drinkName":"温水","note":"起床唤醒"},
    {"time":"10:00","amountMl":400,"drinkName":"绿茶","note":"提神抗氧化"},
    ...
  ]
}

══════════════════════════════════
💊 保健品/维生素自动安排（AI全权决定）
══════════════════════════════════
${hasSupplements ? `用户有以下保健品，你来决定最佳服用时间和方式：
${supplements.map(s => `- [ID:${s.id}] ${s.name}(${s.brand}) | 用量：${s.dosage}${s.timing === 'ai_auto' ? ' | ⚡由AI决定最佳服用时间' : ` | 用户偏好：${s.timing}(参考)`}${s.notes ? ` | 备注：${s.notes}` : ''}`).join('\n')}

🕐 你作为顶级营养师，根据营养科学自动决定每种补充剂的最佳服用时间：

· 脂溶性维生素(A/D/E/K)：必须随含脂肪的正餐服用，否则不吸收。安排在午餐或晚餐
· 维生素C：随早餐或午餐，避免空腹(酸性刺激胃)。不与高剂量B12同服
· B族维生素：早餐随餐，提供全天能量代谢辅酶。空腹可能恶心
· 铁剂：空腹吸收最好但刺激胃，推荐早餐后1小时或睡前。与维C同服↑吸收，与钙/茶/咖啡间隔≥2小时
· 钙剂：随晚餐(夜间血钙下降，此时补钙利用最高)。与铁/锌间隔≥2小时
· 镁剂：睡前30-60分钟(助眠+肌肉放松)。甘氨酸镁/柠檬酸镁吸收好
· 锌剂：随餐(减少胃刺激)，不与钙/铁同服
· 鱼油/Omega-3：随含脂肪的正餐，提高吸收率3倍
· 益生菌：空腹(早起)或睡前，胃酸最低时存活率高
· 蛋白粉/代餐粉：运动后30分钟内，或作为加餐
· 肌酸：运动后+碳水一起摄入提高吸收
· 辅酶Q10：随含脂肪餐，脂溶性
· 姜黄素：随餐+黑胡椒素(提高吸收2000%)
· 褪黑素：睡前30-60分钟

每天在supplements数组中安排所有保健品，标注timing和meal。不要问用户，直接做最科学的决定。` : '无保健品。'}

══════════════════════════════════
${isNoCook ? `🛵 不开火模式：
- 仅从：外卖菜品库(下方列表)、即食产品(便利店饭团/沙拉/酸奶/面包/三明治/水煮蛋)、冲泡类(代餐奶昔/燕麦片/豆浆粉/速食汤)、生食(水果/牛奶/坚果)
- 从外卖库选${Math.min(takeoutDishes.length, 14)}道不同菜品分散到一周，尽量不重复
- cookingMethod标注："外卖""即食""冲泡""生食""微波"` : `🍳 开火模式：
- 自由推荐各种烹饪方式
- cookingMethod标注："煎""蒸""煮""炒""烤""焖""炖""凉拌""生食""微波"`}

${isCarbCycle ? `🔄 碳循环模式：
- 每天标注carbCyclePhase
- 高碳日(high-carb,碳水≥50%热量,2天)：高强度训练日，碳水集中在早餐和训练前后
- 中碳日(medium-carb,碳水30-40%,2天)：中等活动日
- 低碳日(low-carb,碳水≤20%,2天)：休息日/低强度日，增加健康脂肪
- 无碳日(no-carb,碳水<30g,1天)：安排在休息日，主打蛋白质+蔬菜+健康脂肪
- 高低搭配，不连续两天高碳/低碳` : ''}

══════════════════════════════════
📤 返回JSON格式
══════════════════════════════════
返回严格JSON：
{
  "days": [{
    "day": "monday|tuesday|wednesday|thursday|friday|saturday|sunday",
    "meals": {
      "breakfast": [{"name":"食物名","amount":"份量(g/个/碗)","calories":数字,"protein":数字,"carbs":数字,"fat":数字,"cookingMethod":"烹饪方式","fromPantry":true/false,"pantryItemId":"优先消耗食材必填ID","pantryItemName":"食材名","isSupplement":false}],
      "lunch": [...],
      "dinner": [...],
      "snack": [...]
    },
    "dailyTotals":{"calories":数字,"protein":数字,"carbs":数字,"fat":数字},
    ${isCarbCycle ? '"carbCyclePhase":"high-carb|medium-carb|low-carb|no-carb",' : ''}
    "cookingNote":"当日营养要点简述(15字内)",
    ${hasSupplements ? '"supplements":[{"supplementId":"保健品id","name":"名称","timing":"before_meal|with_meal|after_meal","meal":"breakfast|lunch|dinner|snack"}],' : ''}
    "waterIntake":{"totalMl":数字,"schedule":[{"time":"HH:MM","amountMl":数字,"drinkName":"饮品名(温水/绿茶/枸杞水等)","note":"简短说明"}]}
  }],
  "pantryUsageSummary":[{"pantryItemId":"id","name":"名称","usedPerWeek":每周用量(数字,单位与pantry一致),"remainingWeeks":剩余周数,"daysToEmpty":消耗完天数}],
  "totalDaysToGoal":到达目标天数,
  "waterOverview":"一周饮水总览建议(1句话，如含茶饮则包含茶饮建议)"
}

⚠️ JSON必须完整闭合，不能截断。每个字段都必须有值。`;

  // 构建食材描述
  const allItems = [...priorityItems, ...regularItems];
  const pantryDesc = allItems.length > 0
    ? allItems.map(p => {
        const marker = p.priority ? '⚡优先消耗 ' : '';
        return `- [ID:${p.id}] ${marker}${p.name} ${p.brand||''} | ${p.nutrition ? `${p.nutrition.calories}kcal/100g P${p.nutrition.protein}g C${p.nutrition.carbs}g F${p.nutrition.fat}g` : '待分析'} | 剩余:${p.remainingQuantity ?? p.totalQuantity}${p.unit}${p.isDrink ? ' 🍵饮品' : ''}${p.notes ? ` | ${p.notes}` : ''}`;
      }).join('\n')
    : '（食材库为空）';

  const diff = profile.targetWeight - profile.weight;

  const userMsg = `
📋 用户档案：
性别：${profile.gender === 'male' ? '男' : '女'} | 年龄：${profile.age}岁 | 身高：${profile.height}cm
体重：${profile.weight}kg → 目标：${profile.targetWeight}kg（需${diff > 0 ? '增' : '减'}${Math.abs(diff).toFixed(1)}kg）
体脂率：${profile.bodyFat}% | 目标：${profile.goal === 'cut' ? '减脂' : profile.goal === 'bulk' ? '增肌' : '维持'}
饮食方式：${profile.dietMethod} | 烹饪：${profile.cookingPreference === 'cook' ? '开火' : '不开火'}

🎯 每日营养目标：
热量：${analysis.targetCalories}kcal | 蛋白质：${analysis.macroSplit.protein}g | 碳水：${analysis.macroSplit.carbs}g | 脂肪：${analysis.macroSplit.fat}g

${hasTakeoutDB ? '🛵 外卖菜品库：\n' + takeoutDesc + '\n' : ''}

🧺 食材库：
${pantryDesc}

${priorityItems.length > 0 ? '⚠️ 以上标记"⚡优先消耗"的食材请务必在食谱中尽快大量使用！' : ''}
${drinkItems.length > 0 ? '🍵 请根据饮品列表规划每日饮水时间表。' : ''}
${hasSupplements ? '💊 请根据营养科学为每种保健品自动决定最佳服用时间和餐次。' : ''}

请生成完整的一周食谱JSON。
`;

  const response = await callDeepSeek(apiKey, systemPrompt, userMsg, 8192);
  const plan = JSON.parse(extractJSON(response)) as WeeklyMealPlan;
  plan.generatedAt = Date.now();
  return plan;
}
