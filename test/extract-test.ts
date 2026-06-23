// 端到端测试：实际调用 API 验证 JSON 提取
import { readFileSync } from 'fs';

const API_KEY = process.env.DS_KEY || '';

// 完全相同的 extractJSON + repairJSON 逻辑（从 deepseek.ts 复制）
function repairJSON(text: string): string {
  let cleaned = text
    .replace(/\/\/.*$/gm, '')
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/,\s*,/g, ',')
    .replace(/\t/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '');

  cleaned = cleaned.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');

  const chars: string[] = [];
  const stack: string[] = [];
  let inString = false;
  let prevChar = '';

  for (const ch of cleaned) {
    if (ch === '"' && prevChar !== '\\') inString = !inString;
    if (!inString) {
      if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === ch) stack.pop();
      }
    }
    chars.push(ch);
    prevChar = ch;
  }
  if (stack.length > 0) cleaned += stack.reverse().join('');
  return cleaned;
}

function extractJSON(text: string): string {
  let stripped = text
    .split('\n')
    .filter(line => !line.trim().match(/^```\s*$/))
    .map(line => line.replace(/^```\w*/, ''))
    .join('\n')
    .trim();

  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = stripped.slice(firstBrace, lastBrace + 1);
    const opensBrace = (candidate.match(/\{/g) || []).length;
    const closesBrace = (candidate.match(/\}/g) || []).length;
    if (opensBrace >= closesBrace) {
      let depth = 0;
      for (let i = firstBrace; i < stripped.length; i++) {
        if (stripped[i] === '{') depth++;
        else if (stripped[i] === '}') {
          depth--;
          if (depth === 0) return stripped.slice(firstBrace, i + 1);
        }
      }
      return candidate; // fallback: return from first { to last }
    }

    let depth = 0;
    for (let i = firstBrace; i < stripped.length; i++) {
      if (stripped[i] === '{') depth++;
      else if (stripped[i] === '}') {
        depth--;
        if (depth === 0) return stripped.slice(firstBrace, i + 1);
      }
    }
  }

  return stripped;
}

// 模拟 DeepSeek 各种可能的返回格式
const mockResponses = [
  // 最常见的 json_object 模式返回
  `{"bmi":22.5,"bmr":1650,"tdee":2269,"targetCalories":1869,"macroSplit":{"protein":140,"carbs":200,"fat":60},"estimatedDaysToGoal":45,"weeklyWeightChange":-0.6,"summary":"你的BMI正常，建议维持当前体重的同时增肌减脂。"}`,

  // 被 markdown fence 包裹的（最可能的 bug 来源）
  `\`\`\`json
{"bmi":22.5,"bmr":1650,"tdee":2269,"targetCalories":1869,"macroSplit":{"protein":140,"carbs":200,"fat":60},"estimatedDaysToGoal":45,"weeklyWeightChange":-0.6,"summary":"你的BMI正常。"}
\`\`\``,

  // 有前后文字的
  `根据您的数据，分析结果如下：

\`\`\`json
{"bmi":22.5,"bmr":1650,"tdee":2269,"targetCalories":1869,"macroSplit":{"protein":140,"carbs":200,"fat":60},"estimatedDaysToGoal":45,"weeklyWeightChange":-0.6,"summary":"你的BMI正常。"}
\`\`\`

希望对您有帮助！`,

  // 最后有多余逗号的
  `{"bmi":22.5,"bmr":1650,"tdee":2269,"targetCalories":1869,"macroSplit":{"protein":140,"carbs":200,"fat":60,},"estimatedDaysToGoal":45,}`,

  // 嵌套 JSON 被截断
  `{"bmi":22.5,"bmr":1650,"td`,

  // DeepSeek 有时在 json_object 模式仍然加 fence（最新 bug）
  `\`\`\`json
{
  "results": [
    {"name": "测试产品", "brand": "测试品牌", "category": "protein", "nutrition": {"calories": 100, "protein": 20, "carbs": 5, "fat": 2}, "bestMealTime": ["breakfast"], "isDrink": false, "drinkType": "none", "imageUrl": "", "notes": "测试"}
  ]
}
\`\`\``,
];

console.log('=== JSON 提取测试 ===\n');

for (let i = 0; i < mockResponses.length; i++) {
  const raw = mockResponses[i];
  console.log(`\n--- Test Case ${i + 1} ---`);
  console.log(`原始值前50字符: ${raw.slice(0, 50)}...`);

  try {
    const extracted = extractJSON(raw);
    console.log(`提取后前50字符: ${extracted.slice(0, 50)}...`);
    const repaired = repairJSON(extracted);
    const parsed = JSON.parse(repaired);
    console.log(`✅ 成功解析! 字段: ${Object.keys(parsed).join(', ')}`);
  } catch (e: any) {
    const extracted = extractJSON(raw);
    console.log(`❌ 失败!`);
    console.log(`   错误: ${e.message}`);
    console.log(`   提取内容: ${extracted.slice(0, 100)}`);
  }
}

console.log('\n\n=== 如果需要测试真实 API，运行: DS_KEY=sk-xxx npx tsx test/api-test.ts ===');
