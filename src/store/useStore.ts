import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AppState, BodyProfile, PantryItem, BodyAnalysis,
  WeeklyMealPlan, AILoadingState,
} from '../types';

const defaultProfile: BodyProfile = {
  height: 170,
  weight: 65,
  age: 25,
  gender: 'male',
  bodyFat: 20,
  goal: 'maintain',
  dietMethod: 'balanced',
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // 初始数据
      bodyProfile: defaultProfile,
      pantry: [],
      bodyAnalysis: null,
      mealPlan: null,
      apiKey: '',
      analysisState: 'idle',
      pantrySearchState: 'idle',
      mealPlanState: 'idle',
      error: null,

      setBodyProfile: (partial) =>
        set((s) => ({ bodyProfile: { ...s.bodyProfile, ...partial } })),

      addPantryItem: (item) =>
        set((s) => ({
          pantry: [...s.pantry, { ...item, id: item.id || crypto.randomUUID() }],
        })),

      removePantryItem: (id) =>
        set((s) => ({ pantry: s.pantry.filter((p) => p.id !== id) })),

      updatePantryItem: (id, updates) =>
        set((s) => ({
          pantry: s.pantry.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),

      setBodyAnalysis: (analysis) => set({ bodyAnalysis: analysis }),
      setMealPlan: (plan) => set({ mealPlan: plan }),
      setApiKey: (key) => set({ apiKey: key }),

      setAnalysisState: (state) => set({ analysisState: state }),
      setPantrySearchState: (state) => set({ pantrySearchState: state }),
      setMealPlanState: (state) => set({ mealPlanState: state }),
      setError: (error) => set({ error }),

      reset: () =>
        set({
          bodyProfile: defaultProfile,
          pantry: [],
          bodyAnalysis: null,
          mealPlan: null,
          error: null,
        }),
    }),
    {
      name: 'healthy-diet-planner',
      partialize: (state) => ({
        bodyProfile: state.bodyProfile,
        pantry: state.pantry,
        bodyAnalysis: state.bodyAnalysis,
        mealPlan: state.mealPlan,
        apiKey: state.apiKey,
      }),
    }
  )
);
