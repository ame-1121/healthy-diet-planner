import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, BodyProfile, PantryItem, Supplement, TakeoutDish, AILoadingState } from '../types';

const defaultProfile: BodyProfile = {
  height: 170,
  weight: 65,
  age: 25,
  gender: 'male',
  bodyFat: 20,
  goal: 'maintain',
  dietMethod: 'balanced',
  targetWeight: 60,
  cookingPreference: 'cook',
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      bodyProfile: defaultProfile,
      pantry: [],
      supplements: [],
      takeoutDishes: [],
      bodyAnalysis: null,
      mealPlan: null,
      apiKey: '',
      showConsumptionDays: true,
      analysisState: 'idle',
      pantrySearchState: 'idle',
      mealPlanState: 'idle',
      error: null,

      setBodyProfile: (partial) =>
        set((s) => ({ bodyProfile: { ...s.bodyProfile, ...partial } })),

      addPantryItem: (item) =>
        set((s) => ({
          pantry: [
            ...s.pantry,
            {
              ...item,
              id: item.id || crypto.randomUUID(),
              remainingQuantity: item.remainingQuantity ?? item.totalQuantity,
            },
          ],
        })),

      removePantryItem: (id) =>
        set((s) => ({ pantry: s.pantry.filter((p) => p.id !== id) })),

      updatePantryItem: (id, updates) =>
        set((s) => ({
          pantry: s.pantry.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),

      addSupplement: (sup) =>
        set((s) => ({
          supplements: [...s.supplements, { ...sup, id: sup.id || crypto.randomUUID() }],
        })),

      removeSupplement: (id) =>
        set((s) => ({ supplements: s.supplements.filter((x) => x.id !== id) })),

      updateSupplement: (id, updates) =>
        set((s) => ({
          supplements: s.supplements.map((x) => (x.id === id ? { ...x, ...updates } : x)),
        })),

      setTakeoutDishes: (dishes) => set({ takeoutDishes: dishes }),

      setBodyAnalysis: (analysis) => set({ bodyAnalysis: analysis }),
      setMealPlan: (plan) => set({ mealPlan: plan }),
      setApiKey: (key) => set({ apiKey: key }),
      setShowConsumptionDays: (show) => set({ showConsumptionDays: show }),

      setAnalysisState: (state) => set({ analysisState: state }),
      setPantrySearchState: (state) => set({ pantrySearchState: state }),
      setMealPlanState: (state) => set({ mealPlanState: state }),
      setError: (error) => set({ error }),

      reset: () =>
        set({
          bodyProfile: defaultProfile,
          pantry: [],
          supplements: [],
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
        supplements: state.supplements,
        takeoutDishes: state.takeoutDishes,
        bodyAnalysis: state.bodyAnalysis,
        mealPlan: state.mealPlan,
        apiKey: state.apiKey,
        showConsumptionDays: state.showConsumptionDays,
      }),
    }
  )
);
