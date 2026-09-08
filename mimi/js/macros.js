/*
 * THE MACRO CALCULATOR.
 *
 * Mifflin-St Jeor for resting energy, a standard activity multiplier for total
 * daily energy, then a goal adjustment. Protein and fat are set per kilo of
 * bodyweight and carbohydrate takes whatever calories are left, which is the
 * order coaches actually set them in.
 *
 *   BMR (male)   = 10 * kg + 6.25 * cm - 5 * age + 5
 *   BMR (female) = 10 * kg + 6.25 * cm - 5 * age - 161
 *
 * The numbers are a starting point, not a prescription. The UI says so, because
 * a calculator that presents an estimate as a fact is how people end up eating
 * 1,200 calories and wondering why they are tired.
 */
import { clamp, round } from './util.js'

export const ACTIVITY = [
  { id: 'sedentary', label: 'Sedentary', hint: 'Desk job, little movement', factor: 1.2 },
  { id: 'light', label: 'Lightly active', hint: 'Training 1 to 2 days', factor: 1.375 },
  { id: 'moderate', label: 'Moderately active', hint: 'Training 3 to 4 days', factor: 1.55 },
  { id: 'active', label: 'Very active', hint: 'Training 5 to 6 days', factor: 1.725 },
  { id: 'athlete', label: 'Athlete', hint: 'Twice a day, or physical job', factor: 1.9 },
]

export const GOALS = [
  { id: 'cut', label: 'Fat loss', adjust: -0.18, protein: 2.2, fat: 0.8, note: 'A deficit of about 18 percent. Slow enough to keep your strength.' },
  { id: 'maintain', label: 'Maintain', adjust: 0, protein: 1.9, fat: 0.9, note: 'Energy in, energy out. The setting most people should spend most of the year in.' },
  { id: 'bulk', label: 'Build muscle', adjust: 0.12, protein: 2.0, fat: 0.9, note: 'A surplus of about 12 percent. Enough to build, not enough to bury the work.' },
]

export const activityFactor = (id) => (ACTIVITY.find((a) => a.id === id) || ACTIVITY[2]).factor
export const goalPreset = (id) => GOALS.find((g) => g.id === id) || GOALS[1]

export function bmr({ weightKg, heightCm, age, sex }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

export function macrosFor({ weightKg, heightCm, age, sex, activity, goal }) {
  const rest = bmr({ weightKg, heightCm, age, sex })
  const tdee = rest * activityFactor(activity)
  const preset = goalPreset(goal)
  /* Never recommend below 1,200 kcal from a calculator with no clinician behind it. */
  const kcal = Math.max(1200, tdee * (1 + preset.adjust))

  const protein = round(preset.protein * weightKg)
  const fat = round(preset.fat * weightKg)
  const left = kcal - protein * 4 - fat * 9
  const carbs = round(Math.max(50, left / 4))

  return {
    restKcal: Math.round(rest),
    tdee: Math.round(tdee),
    kcal: Math.round(protein * 4 + fat * 9 + carbs * 4),
    protein, carbs, fat,
    note: preset.note,
    floored: kcal <= 1200.0001 && tdee * (1 + preset.adjust) < 1200,
  }
}

/* What one serving of a recipe leaves of the day's targets. */
export function shareOfDay(recipe, targets) {
  if (!targets?.kcal) return 0
  return clamp(Math.round((recipe.kcal / targets.kcal) * 100), 0, 100)
}
