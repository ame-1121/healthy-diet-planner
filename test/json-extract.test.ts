// 测试 extractJSON 和 repairJSON 对各类 DeepSeek 返回格式的处理
import { readFileSync } from 'fs';
import { resolve } from 'path';

// 复制 deepseek.ts 中的核心逻辑来测试
function repairJSON(text: string): string {
  let cleaned = text
    .replace(/\/\/.*$/gm, '')
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/,\s*,/g, ',')
    .replace(/\t/g, ' ')
    .replace(/\\(?!["\\/bfnrtu])/g, '\\\\');

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

// ====== 测试用例 ======
const testCases: { name: string; input: string; shouldFail?: boolean }[] = [
  {
    name: '标准 json code fence',
    input: '```json\n{"a": 1, "b": 2}\n```',
  },
  {
    name: '无语言标记的 fence',
    input: '```\n{"a": 1, "b": 2}\n```',
  },
  {
    name: '直接 JSON（无 fence）',
    input: '{"a": 1, "b": 2}',
  },
  {
    name: '前置文字 + JSON',
    input: '好的一周食谱如下：\n{"days": [{"day": "monday"}]}',
  },
  {
    name: '后置文字 + JSON',
    input: '{"days": [{"day": "monday"}]}\n祝您用餐愉快！',
  },
  {
    name: '尾部多余逗号',
    input: '{"a": 1, "b": 2,}',
  },
  {
    name: '数组尾部逗号',
    input: '{"arr": [1, 2, 3,], "ok": true}',
  },
  {
    name: 'JSON 被截断（缺少闭合括号）',
    input: '{"days": [{"day": "monday", "meals": {"breakfast": []',
  },
  {
    name: '混合：fence + 多余逗号',
    input: '```json\n{"a": 1, "b": 2,}\n```',
  },
  {
    name: '混合：fence + 前后文字',
    input: '这是生成结果：\n```json\n{"result": "ok"}\n```\n请查看。',
  },
  {
    name: '嵌套 JSON 正确',
    input: '```json\n{"outer": {"inner": [1, 2, 3]}}\n```',
  },
  {
    name: '非法转义符',
    input: '{"text": "hello world\\\'s end"}',
  },
  {
    name: '空字符串 value',
    input: '{"name": "", "count": 0}',
  },
];

let pass = 0;
let fail = 0;

for (const tc of testCases) {
  try {
    const extracted = extractJSON(tc.input);
    const repaired = repairJSON(extracted);
    const parsed = JSON.parse(repaired);
    pass++;
    console.log(`✅ ${tc.name}`);
    console.log(`   parsed: ${JSON.stringify(parsed).slice(0, 80)}`);
  } catch (e: any) {
    fail++;
    console.log(`❌ ${tc.name}`);
    console.log(`   input preview: ${tc.input.slice(0, 60)}`);
    console.log(`   extracted: ${extractJSON(tc.input).slice(0, 80)}`);
    console.log(`   repaired: ${repairJSON(extractJSON(tc.input)).slice(0, 80)}`);
    console.log(`   error: ${e.message}`);
  }
}

console.log(`\n=== ${pass}/${pass+fail} passed ===`);

if (fail > 0) {
  process.exit(1);
}
