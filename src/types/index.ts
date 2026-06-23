// ========== 用户身体数据 ==========
export interface BodyProfile {
  height: number;        // cm
  weight: number;        // kg
  age: number;
  gender: 'male' | 'female';
  bodyFat: number;       // %
  goal: 'cut' | 'bulk' | 'maintain';
  dietMethod: 'balanced' | 'carb-cycle' | 'low-carb' | 'high-protein' | 'if-16-8';
  targetWeight: number;  // 目标体重 kg
  cookingPreference: 'cook' | 'nocook';  // 开火/不开火
}

// ========== AI 分析结果 ==========
export interface BodyAnalysis {
  bmi: number;
  bmr: number;
  tdee: number;
  targetCalories: number;
  macroSplit: {
    protein: number;   // g
    carbs: number;     // g
    fat: number;       // g
  };
  estimatedDaysToGoal: number;   // 预计达到目标体重天数
  weeklyWeightChange: number;     // 每周预计体重变化 kg（正=增重，负=减重）
  summary: string;
}

// ========== 食材 ==========
export interface PantryItem {
  id: string;
  name: string;
  category: 'protein' | 'carb' | 'fat' | 'vegetable' | 'fruit' | 'dairy' | 'other' | 'unknown';
  // 每100g营养数据 (AI填充)
  nutrition?: {
    calories: number;   // kcal/100g
    protein: number;    // g/100g
    carbs: number;      // g/100g
    fat: number;        // g/100g
    fiber?: number;     // g/100g
  };
  totalQuantity: number;    // 总量（以 unit 为单位）
  remainingQuantity: number; // 剩余数量
  unit: string;             // 单位 e.g. "g", "个", "袋", "瓶", "盒"
  brand?: string;           // 品牌名 (AI填充)
  imageUrl?: string;        // 产品图片URL (AI填充)
  purchaseLink?: string;    // 购买链接
  bestMealTime?: ('breakfast' | 'lunch' | 'dinner' | 'snack')[];
  daysToConsume?: number;   // 预计几天消耗完 (根据食谱计算)
  notes?: string;
}

// ========== 食谱 ==========
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface MealEntry {
  name: string;           // 食物名
  amount: string;         // 份量 e.g. "150g"
  calories: number;       // 卡路里
  protein: number;        // 蛋白 g
  carbs: number;          // 碳水 g
  fat: number;            // 脂肪 g
  fromPantry?: boolean;   // 是否来自已有食材
  pantryItemId?: string;  // 对应食材ID
  pantryItemName?: string;// 对应食材名称
  cookingMethod?: string; // 烹饪方式 e.g. "即食""冲泡""外卖""煎""蒸"
}

export interface PantryUsageSummary {
  pantryItemId: string;
  name: string;
  usedPerWeek: number;      // 每周用量
  remainingWeeks: number;   // 还能用几周
  daysToEmpty: number;      // 几天后消耗完
}

export interface DayMealPlan {
  day: DayOfWeek;
  meals: {
    [key in MealSlot]: MealEntry[];
  };
  dailyTotals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  carbCyclePhase?: 'high-carb' | 'low-carb' | 'no-carb' | 'medium-carb';  // 碳循环阶段
  cookingNote?: string;      // 当日烹饪方式备注
}

export interface WeeklyMealPlan {
  days: DayMealPlan[];
  generatedAt: number;
  pantryUsageSummary?: PantryUsageSummary[];  // 食材消耗预估
  totalDaysToGoal?: number;  // 计划执行多久达到目标体重
}

// ========== AI 交互 ==========
export type AILoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AppState {
  // 数据
  bodyProfile: BodyProfile;
  pantry: PantryItem[];
  bodyAnalysis: BodyAnalysis | null;
  mealPlan: WeeklyMealPlan | null;
  apiKey: string;

  // 加载状态
  analysisState: AILoadingState;
  pantrySearchState: AILoadingState;
  mealPlanState: AILoadingState;

  // 错误信息
  error: string | null;

  // Actions
  setBodyProfile: (profile: Partial<BodyProfile>) => void;
  addPantryItem: (item: PantryItem) => void;
  removePantryItem: (id: string) => void;
  updatePantryItem: (id: string, updates: Partial<PantryItem>) => void;
  setBodyAnalysis: (analysis: BodyAnalysis | null) => void;
  setMealPlan: (plan: WeeklyMealPlan | null) => void;
  setApiKey: (key: string) => void;
  setAnalysisState: (state: AILoadingState) => void;
  setPantrySearchState: (state: AILoadingState) => void;
  setMealPlanState: (state: AILoadingState) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}
