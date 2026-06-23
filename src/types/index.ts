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
  estimatedDaysToGoal: number;
  weeklyWeightChange: number;
  summary: string;
}

// ========== 食材 ==========
export const UNIT_OPTIONS = ['g', '个', '份', '粒', '包', '袋', '瓶', '盒', '罐', '勺', '杯', '片', '块'] as const;

export interface PantryItem {
  id: string;
  name: string;
  category: 'protein' | 'carb' | 'fat' | 'vegetable' | 'fruit' | 'dairy' | 'supplement' | 'other' | 'unknown';
  nutrition?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
  };
  totalQuantity: number;
  remainingQuantity: number;
  unit: string;
  brand?: string;
  imageUrl?: string;
  purchaseLink?: string;
  bestMealTime?: ('breakfast' | 'lunch' | 'dinner' | 'snack')[];
  daysToConsume?: number;
  notes?: string;
}

// ========== 维生素 & 保健品 ==========
export type SupplementTiming = 'before_meal' | 'with_meal' | 'after_meal';

export interface Supplement {
  id: string;
  name: string;                // e.g. "维生素C片"
  brand: string;               // e.g. "汤臣倍健"
  dosage: string;              // e.g. "1片/天"
  timing: SupplementTiming;    // 饭前/随餐/饭后
  bestMeal?: 'breakfast' | 'lunch' | 'dinner' | 'snack'; // 最佳在哪个餐次
  notes?: string;
}

// ========== 外卖菜品库 ==========
export interface TakeoutDish {
  id: string;
  name: string;           // 菜品名
  restaurant: string;     // 店名
  category: string;       // 分类
  nutrition: {            // 估算每份
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  amount: string;         // 份量
  tags?: string[];        // e.g. "高蛋白""低脂""辣"
}

// ========== 食谱 ==========
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface MealEntry {
  name: string;
  amount: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fromPantry?: boolean;
  pantryItemId?: string;
  pantryItemName?: string;
  cookingMethod?: string;
  isSupplement?: boolean;   // 是否为保健品
  supplementTiming?: SupplementTiming;
  supplementId?: string;
}

export interface PantryUsageSummary {
  pantryItemId: string;
  name: string;
  usedPerWeek: number;
  remainingWeeks: number;
  daysToEmpty: number;
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
  carbCyclePhase?: 'high-carb' | 'low-carb' | 'medium-carb' | 'no-carb';
  cookingNote?: string;
  supplements?: {             // 当天推荐的保健品
    supplementId: string;
    name: string;
    timing: SupplementTiming;
    meal: MealSlot;
  }[];
}

export interface WeeklyMealPlan {
  days: DayMealPlan[];
  generatedAt: number;
  pantryUsageSummary?: PantryUsageSummary[];
  totalDaysToGoal?: number;
}

// ========== AI 交互 ==========
export type AILoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AppState {
  bodyProfile: BodyProfile;
  pantry: PantryItem[];
  supplements: Supplement[];
  takeoutDishes: TakeoutDish[];   // 预存外卖库
  bodyAnalysis: BodyAnalysis | null;
  mealPlan: WeeklyMealPlan | null;
  apiKey: string;
  showConsumptionDays: boolean;   // 消耗天数显示开关

  analysisState: AILoadingState;
  pantrySearchState: AILoadingState;
  mealPlanState: AILoadingState;
  error: string | null;

  setBodyProfile: (profile: Partial<BodyProfile>) => void;
  addPantryItem: (item: PantryItem) => void;
  removePantryItem: (id: string) => void;
  updatePantryItem: (id: string, updates: Partial<PantryItem>) => void;
  addSupplement: (sup: Supplement) => void;
  removeSupplement: (id: string) => void;
  updateSupplement: (id: string, updates: Partial<Supplement>) => void;
  setTakeoutDishes: (dishes: TakeoutDish[]) => void;
  setBodyAnalysis: (analysis: BodyAnalysis | null) => void;
  setMealPlan: (plan: WeeklyMealPlan | null) => void;
  setApiKey: (key: string) => void;
  setShowConsumptionDays: (show: boolean) => void;
  setAnalysisState: (state: AILoadingState) => void;
  setPantrySearchState: (state: AILoadingState) => void;
  setMealPlanState: (state: AILoadingState) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}
