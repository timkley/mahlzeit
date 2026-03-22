<script setup lang="ts">
useHead({ title: 'Kalorientracker' })

const selectedDate = ref(new Date().toISOString().slice(0, 10))

const displayDate = computed(() => {
  const d = new Date(selectedDate.value + 'T12:00:00')
  return d.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

const isToday = computed(() => selectedDate.value === new Date().toISOString().slice(0, 10))

function shiftDay(offset: number) {
  const d = new Date(selectedDate.value + 'T12:00:00')
  d.setDate(d.getDate() + offset)
  selectedDate.value = d.toISOString().slice(0, 10)
}

const { data: meals, refresh: refreshMeals } = useFetch('/api/meals', {
  query: { date: selectedDate },
  watch: [selectedDate],
})

const { data: goalData, refresh: refreshGoal } = useFetch('/api/settings/goal')
const goal = computed(() => goalData.value?.goal ?? 2000)

// --- Goal editing ---
const isEditingGoal = ref(false)
const goalInput = ref(2000)

function startEditGoal() {
  goalInput.value = goal.value
  isEditingGoal.value = true
}

async function saveGoal() {
  if (goalInput.value < 1) return
  await $fetch('/api/settings/goal', {
    method: 'PUT',
    body: { goal: goalInput.value },
  })
  isEditingGoal.value = false
  await refreshGoal()
}

// 7-day rolling stats
const { data: weeklyData } = useFetch('/api/stats/weekly', {
  query: { date: selectedDate },
  watch: [selectedDate],
})

// Short weekday label for the mini chart
function dayLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short' })
}

// Bar height as percentage of goal
function barPercent(calories: number): number {
  return Math.min(Math.round((calories / goal.value) * 100), 120)
}

const totalCalories = computed(() =>
  (meals.value || []).reduce((sum, m) => sum + (m.calories || 0), 0),
)
const totalProtein = computed(() =>
  (meals.value || []).reduce((sum, m) => sum + (m.protein || 0), 0),
)
const totalCarbs = computed(() =>
  (meals.value || []).reduce((sum, m) => sum + (m.carbs || 0), 0),
)
const totalFat = computed(() =>
  (meals.value || []).reduce((sum, m) => sum + (m.fat || 0), 0),
)

const progressPercent = computed(() =>
  Math.min(Math.round((totalCalories.value / goal.value) * 100), 100),
)

const progressColor = computed(() => {
  const pct = (totalCalories.value / goal.value) * 100
  if (pct < 75) return 'text-emerald-600 dark:text-emerald-400'
  if (pct < 100) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
})

const mealTimeLabel: Record<string, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snack / Sonstiges',
}

const mealTypes = [
  { value: 'breakfast', label: 'Frühstück' },
  { value: 'lunch', label: 'Mittagessen' },
  { value: 'dinner', label: 'Abendessen' },
  { value: 'snack', label: 'Snack / Sonstiges' },
]

// --- Inline editing state ---
const editingId = ref<number | null>(null)
const editForm = ref({
  description: '',
  calories: 0 as number,
  protein: null as number | null,
  carbs: null as number | null,
  fat: null as number | null,
  mealTime: '',
})
const isSaving = ref(false)
const confirmDeleteId = ref<number | null>(null)

function startEdit(meal: any) {
  if (editingId.value === meal.id) {
    editingId.value = null
    return
  }

  // Use View Transition API for the expand/collapse if available
  if (document.startViewTransition) {
    document.startViewTransition(() => {
      applyEdit(meal)
    })
  }
  else {
    applyEdit(meal)
  }
}

function applyEdit(meal: any) {
  editingId.value = meal.id
  confirmDeleteId.value = null
  editForm.value = {
    description: meal.description,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    mealTime: meal.mealTime ?? 'snack',
  }
}

function cancelEdit() {
  if (document.startViewTransition) {
    document.startViewTransition(() => {
      editingId.value = null
      confirmDeleteId.value = null
    })
  }
  else {
    editingId.value = null
    confirmDeleteId.value = null
  }
}

async function saveEdit() {
  if (!editingId.value) return
  isSaving.value = true
  try {
    await $fetch(`/api/meals/${editingId.value}`, {
      method: 'PUT',
      body: editForm.value,
    })
    editingId.value = null
    await refreshMeals()
  }
  finally {
    isSaving.value = false
  }
}

async function deleteMeal(id: number) {
  if (confirmDeleteId.value !== id) {
    // First tap: show confirmation
    confirmDeleteId.value = id
    return
  }
  // Second tap: actually delete
  await $fetch(`/api/meals/${id}`, { method: 'DELETE' })
  editingId.value = null
  confirmDeleteId.value = null
  await refreshMeals()
}
</script>

<template>
  <div class="min-h-screen bg-background px-4 py-6">
    <div class="max-w-lg mx-auto space-y-5">
      <!-- Day navigation -->
      <div class="flex items-center justify-between">
        <Button variant="ghost" size="icon" @click="shiftDay(-1)">
          <i class="ri-arrow-left-s-line text-lg" />
        </Button>
        <div class="text-center">
          <h1 class="text-lg font-bold">{{ displayDate }}</h1>
          <button
            v-if="!isToday"
            class="text-xs text-muted-foreground hover:text-foreground"
            @click="selectedDate = new Date().toISOString().slice(0, 10)"
          >
            Heute
          </button>
        </div>
        <Button variant="ghost" size="icon" :disabled="isToday" @click="shiftDay(1)">
          <i class="ri-arrow-right-s-line text-lg" />
        </Button>
      </div>

      <!-- Calorie summary + 7-day stats -->
      <Card>
        <CardContent class="pt-6 space-y-4">
          <!-- Today -->
          <div>
            <p class="text-xs text-muted-foreground uppercase tracking-wide mb-1">Heute</p>
            <div class="flex items-baseline justify-between">
              <span class="text-3xl font-bold" :class="progressColor" style="view-transition-name: calorie-total">
                {{ totalCalories.toLocaleString('de-DE') }}
              </span>
              <span v-if="!isEditingGoal" class="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors" @click="startEditGoal">
                / {{ goal.toLocaleString('de-DE') }} kcal <i class="ri-pencil-line text-xs" />
              </span>
              <span v-else class="flex items-center gap-1">
                <span class="text-sm text-muted-foreground">/</span>
                <Input
                  v-model.number="goalInput"
                  type="number"
                  min="1"
                  class="w-20 h-7 text-sm text-right"
                  @keydown.enter="saveGoal"
                  @keydown.escape="isEditingGoal = false"
                />
                <span class="text-sm text-muted-foreground">kcal</span>
                <Button variant="ghost" size="icon" class="h-7 w-7" @click="saveGoal">
                  <i class="ri-check-line" />
                </Button>
                <Button variant="ghost" size="icon" class="h-7 w-7" @click="isEditingGoal = false">
                  <i class="ri-close-line" />
                </Button>
              </span>
            </div>
            <Progress :model-value="progressPercent" class="h-3 mt-2" />
            <div v-if="totalProtein || totalCarbs || totalFat" class="flex gap-4 text-xs text-muted-foreground pt-1">
              <span v-if="totalProtein">P: {{ totalProtein.toFixed(0) }}g</span>
              <span v-if="totalCarbs">K: {{ totalCarbs.toFixed(0) }}g</span>
              <span v-if="totalFat">F: {{ totalFat.toFixed(0) }}g</span>
            </div>
          </div>

          <!-- 7-day rolling stats -->
          <div v-if="weeklyData?.days">
            <Separator class="my-1" />
            <p class="text-xs text-muted-foreground uppercase tracking-wide mb-2 mt-3">Letzte 7 Tage</p>

            <!-- Mini bar chart -->
            <div class="flex items-end justify-between gap-1 h-20">
              <div
                v-for="day in weeklyData.days"
                :key="day.date"
                class="flex-1 flex flex-col items-center gap-0.5"
              >
                <!-- Bar -->
                <div class="w-full flex items-end justify-center" style="height: 52px">
                  <div
                    class="w-full max-w-[28px] rounded-t transition-all"
                    :class="[
                      day.date === selectedDate
                        ? 'bg-primary'
                        : day.calories > goal ? 'bg-red-400 dark:bg-red-500' : 'bg-muted-foreground/25',
                    ]"
                    :style="{ height: day.calories ? `${Math.max(barPercent(day.calories) * 0.52, 2)}px` : '2px' }"
                  />
                </div>
                <!-- Day label -->
                <span
                  class="text-[10px] leading-none"
                  :class="day.date === selectedDate ? 'text-foreground font-bold' : 'text-muted-foreground'"
                >
                  {{ dayLabel(day.date) }}
                </span>
              </div>
            </div>

            <!-- Averages -->
            <div class="flex items-baseline justify-between mt-2 pt-2 border-t border-border/50">
              <span class="text-sm font-medium">
                ⌀ {{ weeklyData.avg.calories.toLocaleString('de-DE') }} kcal
              </span>
              <div class="text-xs text-muted-foreground space-x-2">
                <span>P: {{ weeklyData.avg.protein }}g</span>
                <span>K: {{ weeklyData.avg.carbs }}g</span>
                <span>F: {{ weeklyData.avg.fat }}g</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Meal list -->
      <div v-if="meals?.length" class="space-y-2">
        <Card v-for="meal in meals" :key="meal.id" :style="{ viewTransitionName: `meal-${meal.id}` }">
          <!-- View mode -->
          <CardContent
            v-if="editingId !== meal.id"
            class="py-3 flex items-center justify-between cursor-pointer"
            @click="startEdit(meal)"
          >
            <div class="min-w-0">
              <p class="font-medium truncate">{{ meal.description }}</p>
              <p class="text-xs text-muted-foreground">
                {{ mealTimeLabel[meal.mealTime ?? ''] || '' }}
              </p>
            </div>
            <span class="text-sm font-bold whitespace-nowrap ml-3">
              {{ meal.calories?.toLocaleString('de-DE') }} kcal
            </span>
          </CardContent>

          <!-- Edit mode -->
          <CardContent v-else class="py-4 space-y-3">
            <div class="space-y-2">
              <Label>Beschreibung</Label>
              <Input v-model="editForm.description" />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <Button
                v-for="type in mealTypes"
                :key="type.value"
                type="button"
                size="sm"
                :variant="editForm.mealTime === type.value ? 'default' : 'outline'"
                @click="editForm.mealTime = type.value"
              >
                {{ type.label }}
              </Button>
            </div>

            <div class="space-y-2">
              <Label>Kalorien (kcal)</Label>
              <Input v-model.number="editForm.calories" type="number" min="0" />
            </div>

            <div class="grid grid-cols-3 gap-2">
              <div>
                <Label class="text-xs text-muted-foreground">Protein (g)</Label>
                <Input v-model.number="editForm.protein" type="number" min="0" step="0.1" />
              </div>
              <div>
                <Label class="text-xs text-muted-foreground">Kohlenh. (g)</Label>
                <Input v-model.number="editForm.carbs" type="number" min="0" step="0.1" />
              </div>
              <div>
                <Label class="text-xs text-muted-foreground">Fett (g)</Label>
                <Input v-model.number="editForm.fat" type="number" min="0" step="0.1" />
              </div>
            </div>

            <!-- Action buttons -->
            <div class="flex gap-2 pt-1">
              <Button class="flex-1" :disabled="isSaving" @click="saveEdit">
                <i v-if="isSaving" class="ri-loader-4-line animate-spin" />
                {{ isSaving ? 'Speichern...' : 'Speichern' }}
              </Button>
              <Button variant="outline" @click="cancelEdit">
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                size="icon"
                @click="deleteMeal(meal.id)"
              >
                <i :class="confirmDeleteId === meal.id ? 'ri-alert-line' : 'ri-delete-bin-line'" />
              </Button>
            </div>
            <p v-if="confirmDeleteId === meal.id" class="text-xs text-destructive">
              Nochmal tippen zum Löschen
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-10 text-muted-foreground">
        <i class="ri-restaurant-line text-4xl mb-2 block" />
        <p>Noch keine Mahlzeiten eingetragen.</p>
      </div>

      <!-- Add meal button -->
      <NuxtLink to="/add" style="view-transition-name: add-meal-action">
        <Button class="w-full" size="lg">
          <i class="ri-add-line" /> Mahlzeit hinzufügen
        </Button>
      </NuxtLink>
    </div>
  </div>
</template>
