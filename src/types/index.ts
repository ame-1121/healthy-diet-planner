// ========== 用户身体数据 ==========
export interface BodyProfile {
  height: number;        // cm
  weight: number;        // kg
  age: number;
  gender: 'male' | 'female';
  bodyFat: number;       // %
  goal: 'cut' | 'bulk' | 'maintain';
  dietMethod: 'balanced' | 'carb-cycle' | 'low-carb' | 'high-protein' | 'if-16-8';
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
  quantity?: number;    // 当前有多少份
  unit?: string;        // 单位 (e.g. 个, g, 袋)
  bestMealTime?: ('breakfast' | 'lunch' | 'dinner' | 'snack')[];
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
}

export interface WeeklyMealPlan {
  days: DayMealPlan[];
  generatedAt: number; // timestamp
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
