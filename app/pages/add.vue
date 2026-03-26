<script setup lang="ts">
useHead({ title: 'Mahlzeit hinzufügen' })

const { resizeImage, getImagesFromPaste } = useImageResize()

// --- Shared state ---
function suggestMealTime(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 10) return 'breakfast'
  if (hour >= 11 && hour < 14) return 'lunch'
  if (hour >= 17 && hour < 21) return 'dinner'
  return 'snack'
}

const today = new Date().toISOString().slice(0, 10)
const mealDate = ref(today)
const mealTime = ref(suggestMealTime())
const isSubmitting = ref(false)
const error = ref('')
const mode = ref<'ai' | 'manual'>('ai')

const mealTypes = [
  { value: 'breakfast', label: 'Frühstück' },
  { value: 'lunch', label: 'Mittagessen' },
  { value: 'dinner', label: 'Abendessen' },
  { value: 'snack', label: 'Snack / Sonstiges' },
]

// --- Manual mode state ---
const manualDescription = ref('')
const manualCalories = ref<number | undefined>()
const manualProtein = ref<number | undefined>()
const manualCarbs = ref<number | undefined>()
const manualFat = ref<number | undefined>()

// --- AI mode state ---
const aiDescription = ref('')
const aiImages = ref<{ file: File; preview: string; base64: string }[]>([])
const isAnalyzing = ref(false)
const analysisModel = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

// Analysis items with per-100g values + editable portion
interface AnalysisItem {
  name: string
  portion_grams: number
  per100g: { calories: number; protein: number; carbs: number; fat: number }
  source: 'usda' | 'ai' | 'label'
  usda_match: string | null
}
const analysisItems = ref<AnalysisItem[]>([])
const hasAnalysis = computed(() => analysisItems.value.length > 0)

// Computed scaled values per item
function scaled(item: AnalysisItem) {
  const f = item.portion_grams / 100
  return {
    calories: Math.round(item.per100g.calories * f),
    protein: Math.round(item.per100g.protein * f * 10) / 10,
    carbs: Math.round(item.per100g.carbs * f * 10) / 10,
    fat: Math.round(item.per100g.fat * f * 10) / 10,
  }
}

// Totals across all items
const totals = computed(() => {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0 }
  for (const item of analysisItems.value) {
    const s = scaled(item)
    t.calories += s.calories
    t.protein += s.protein
    t.carbs += s.carbs
    t.fat += s.fat
  }
  // Round totals
  t.protein = Math.round(t.protein * 10) / 10
  t.carbs = Math.round(t.carbs * 10) / 10
  t.fat = Math.round(t.fat * 10) / 10
  return t
})

// --- Image handling ---
async function addImages(files: File[]) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    const base64 = await resizeImage(file)
    aiImages.value.push({
      file,
      preview: URL.createObjectURL(file),
      base64,
    })
  }
}

function removeImage(index: number) {
  const img = aiImages.value[index]
  if (img) URL.revokeObjectURL(img.preview)
  aiImages.value.splice(index, 1)
}

function handlePaste(event: ClipboardEvent) {
  const files = getImagesFromPaste(event)
  if (files.length) {
    event.preventDefault()
    addImages(files)
  }
}

function handleFilePick(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) {
    addImages(Array.from(input.files))
    input.value = ''
  }
}

function handleTextareaKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault()
    analyze()
  }
}

// --- Analysis ---
async function analyze() {
  error.value = ''

  if (!aiDescription.value && aiImages.value.length === 0) {
    error.value = 'Beschreibe die Mahlzeit oder füge ein Foto hinzu.'
    return
  }

  isAnalyzing.value = true

  try {
    const allItems: AnalysisItem[] = []
    let model = ''

    if (aiImages.value.length > 0) {
      for (const img of aiImages.value) {
        const res: any = await $fetch('/api/analyze/image', {
          method: 'POST',
          body: {
            image: img.base64,
            description: aiDescription.value || undefined,
          },
        })
        allItems.push(...res.analysis.items)
        model = res.model
      }
    }
    else {
      const res: any = await $fetch('/api/analyze/text', {
        method: 'POST',
        body: { description: aiDescription.value },
      })
      allItems.push(...res.analysis.items)
      model = res.model
    }

    analysisItems.value = allItems
    analysisModel.value = model
  }
  catch (e: any) {
    error.value = e.data?.message || 'Analyse fehlgeschlagen.'
  }
  finally {
    isAnalyzing.value = false
  }
}

function removeItem(index: number) {
  analysisItems.value.splice(index, 1)
}

function resetAnalysis() {
  analysisItems.value = []
  analysisModel.value = ''
}

// --- Save ---
async function saveMeal() {
  error.value = ''
  isSubmitting.value = true

  try {
    let description: string
    let calories: number
    let protein: number | null = null
    let carbs: number | null = null
    let fat: number | null = null
    let aiResponse: string | null = null

    if (mode.value === 'ai' && hasAnalysis.value) {
      description = analysisItems.value.map(i => i.name).join(', ')
      calories = totals.value.calories
      protein = totals.value.protein
      carbs = totals.value.carbs
      fat = totals.value.fat
      aiResponse = JSON.stringify(analysisItems.value)
    }
    else {
      if (!manualDescription.value || !manualCalories.value) {
        error.value = 'Beschreibung und Kalorien sind erforderlich.'
        isSubmitting.value = false
        return
      }
      description = manualDescription.value
      calories = manualCalories.value
      protein = manualProtein.value || null
      carbs = manualCarbs.value || null
      fat = manualFat.value || null
    }

    await $fetch('/api/meals', {
      method: 'POST',
      body: {
        description,
        calories,
        protein,
        carbs,
        fat,
        mealDate: mealDate.value,
        mealTime: mealTime.value,
        aiResponse,
      },
    })

    await navigateTo('/')
  }
  catch (e: any) {
    error.value = e.data?.message || 'Fehler beim Speichern.'
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-background px-4 py-6">
    <div class="max-w-lg mx-auto">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <NuxtLink to="/">
          <Button variant="ghost" size="sm">
            <i class="ri-arrow-left-line" /> Zurück
          </Button>
        </NuxtLink>
        <h1 class="text-xl font-bold" style="view-transition-name: add-meal-action">
          Mahlzeit hinzufügen
        </h1>
      </div>

      <!-- Error -->
      <div v-if="error" class="rounded-lg border border-destructive/50 bg-destructive/10 p-3 mb-4 text-sm text-destructive">
        {{ error }}
      </div>

      <!-- Mode tabs -->
      <Tabs v-model="mode" class="mb-4">
        <TabsList class="w-full">
          <TabsTrigger value="ai" class="flex-1">
            <i class="ri-sparkling-2-line mr-1" /> KI-Erkennung
          </TabsTrigger>
          <TabsTrigger value="manual" class="flex-1">
            <i class="ri-edit-line mr-1" /> Manuell
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <!-- ============= AI MODE ============= -->
      <div v-if="mode === 'ai'">
        <!-- Input area -->
        <Card v-if="!hasAnalysis">
          <CardContent class="pt-6 space-y-4">
            <div class="space-y-2">
              <Label>Beschreibe die Mahlzeit oder füge Fotos ein</Label>
              <div class="relative">
                <textarea
                  v-model="aiDescription"
                  class="flex min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="z.B. Hähnchenbrust mit Reis und Salat — oder ein Foto einfügen (⌘V)"
                  @paste="handlePaste"
                  @keydown="handleTextareaKeydown"
                />
                <button
                  type="button"
                  class="absolute right-2 bottom-2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  @click="fileInput?.click()"
                >
                  <i class="ri-camera-line text-lg" />
                </button>
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  class="hidden"
                  @change="handleFilePick"
                >
              </div>
            </div>

            <!-- Image previews -->
            <div v-if="aiImages.length" class="flex gap-2 flex-wrap">
              <div
                v-for="(img, i) in aiImages"
                :key="i"
                class="relative group w-20 h-20 rounded-lg overflow-hidden border"
              >
                <img :src="img.preview" class="w-full h-full object-cover" alt="Vorschau">
                <button
                  type="button"
                  class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  @click="removeImage(i)"
                >
                  <i class="ri-close-line text-white text-xl" />
                </button>
              </div>
            </div>

            <Button class="w-full" size="lg" :disabled="isAnalyzing" @click="analyze">
              <i v-if="isAnalyzing" class="ri-loader-4-line animate-spin" />
              <i v-else class="ri-sparkling-2-line" />
              {{ isAnalyzing ? 'Analysiere...' : 'Analysieren' }}
            </Button>
          </CardContent>
        </Card>

        <!-- Results -->
        <div v-else class="space-y-4">
          <Card>
            <CardContent class="pt-6 space-y-4">
              <div class="flex items-center justify-between">
                <h2 class="font-bold">Ergebnis</h2>
                <Button variant="ghost" size="sm" @click="resetAnalysis">
                  <i class="ri-restart-line" /> Nochmal
                </Button>
              </div>

              <!-- Item cards -->
              <div class="space-y-3">
                <div
                  v-for="(item, i) in analysisItems"
                  :key="i"
                  class="rounded-lg border p-3 space-y-2"
                >
                  <!-- Item header -->
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <p class="font-medium text-sm">{{ item.name }}</p>
                      <p class="text-xs text-muted-foreground">
                        <Badge v-if="item.source === 'label'" variant="secondary" class="text-[10px] px-1 py-0">Etikett</Badge>
                        <Badge v-else-if="item.source === 'usda'" variant="secondary" class="text-[10px] px-1 py-0">USDA</Badge>
                        <Badge v-else variant="outline" class="text-[10px] px-1 py-0">KI</Badge>
                        <span v-if="item.usda_match" class="ml-1">{{ item.usda_match }}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      class="p-1 text-muted-foreground hover:text-destructive shrink-0"
                      @click="removeItem(i)"
                    >
                      <i class="ri-close-line" />
                    </button>
                  </div>

                  <!-- Per-100g reference + portion input -->
                  <div class="grid grid-cols-5 gap-1.5 text-xs">
                    <div class="text-muted-foreground text-center" />
                    <div class="text-muted-foreground text-center">kcal</div>
                    <div class="text-muted-foreground text-center">Prot.</div>
                    <div class="text-muted-foreground text-center">Kh.</div>
                    <div class="text-muted-foreground text-center">Fett</div>

                    <!-- Per 100g row (editable) -->
                    <div class="text-muted-foreground text-right self-center text-[11px]">je 100g</div>
                    <Input v-model.number="item.per100g.calories" type="number" min="0" class="h-7 text-xs text-center px-1" />
                    <Input v-model.number="item.per100g.protein" type="number" min="0" step="0.1" class="h-7 text-xs text-center px-1" />
                    <Input v-model.number="item.per100g.carbs" type="number" min="0" step="0.1" class="h-7 text-xs text-center px-1" />
                    <Input v-model.number="item.per100g.fat" type="number" min="0" step="0.1" class="h-7 text-xs text-center px-1" />

                    <!-- Portion row (editable) -->
                    <div class="self-center">
                      <Input
                        v-model.number="item.portion_grams"
                        type="number"
                        min="1"
                        class="h-7 text-xs text-center px-1"
                      />
                    </div>

                    <!-- Scaled values (computed, read-only) -->
                    <div class="text-center self-center font-medium">{{ scaled(item).calories }}</div>
                    <div class="text-center self-center font-medium">{{ scaled(item).protein }}</div>
                    <div class="text-center self-center font-medium">{{ scaled(item).carbs }}</div>
                    <div class="text-center self-center font-medium">{{ scaled(item).fat }}</div>
                  </div>
                  <p class="text-[10px] text-muted-foreground text-right">Werte je 100g und Gramm anpassen — Ergebnis berechnet sich automatisch</p>
                </div>
              </div>

              <Separator />

              <!-- Totals -->
              <div class="grid grid-cols-5 gap-1.5 text-sm">
                <div class="font-bold">Gesamt</div>
                <div class="text-center font-bold">{{ totals.calories }}</div>
                <div class="text-center text-muted-foreground">{{ totals.protein }}</div>
                <div class="text-center text-muted-foreground">{{ totals.carbs }}</div>
                <div class="text-center text-muted-foreground">{{ totals.fat }}</div>
                <div />
                <div class="text-center text-xs text-muted-foreground">kcal</div>
                <div class="text-center text-xs text-muted-foreground">P (g)</div>
                <div class="text-center text-xs text-muted-foreground">K (g)</div>
                <div class="text-center text-xs text-muted-foreground">F (g)</div>
              </div>
            </CardContent>
          </Card>

          <!-- Meal type + date + save -->
          <Card>
            <CardContent class="pt-6 space-y-4">
              <div class="space-y-2">
                <Label>Mahlzeit</Label>
                <div class="grid grid-cols-2 gap-2">
                  <Button
                    v-for="type in mealTypes"
                    :key="type.value"
                    type="button"
                    :variant="mealTime === type.value ? 'default' : 'outline'"
                    size="sm"
                    @click="mealTime = type.value"
                  >
                    {{ type.label }}
                  </Button>
                </div>
              </div>

              <div class="space-y-2">
                <Label for="date">Datum</Label>
                <Input id="date" v-model="mealDate" type="date" />
              </div>

              <Button class="w-full" size="lg" :disabled="isSubmitting" @click="saveMeal">
                <i v-if="isSubmitting" class="ri-loader-4-line animate-spin" />
                {{ isSubmitting ? 'Wird gespeichert...' : 'Speichern' }}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- ============= MANUAL MODE ============= -->
      <Card v-if="mode === 'manual'">
        <CardContent class="pt-6">
          <form class="space-y-4" @submit.prevent="saveMeal">
            <div class="space-y-2">
              <Label for="description">Was hast du gegessen?</Label>
              <Input id="description" v-model="manualDescription" placeholder="z.B. Hähnchenbrust mit Reis" />
            </div>

            <div class="space-y-2">
              <Label>Mahlzeit</Label>
              <div class="grid grid-cols-2 gap-2">
                <Button
                  v-for="type in mealTypes"
                  :key="type.value"
                  type="button"
                  :variant="mealTime === type.value ? 'default' : 'outline'"
                  size="sm"
                  @click="mealTime = type.value"
                >
                  {{ type.label }}
                </Button>
              </div>
            </div>

            <div class="space-y-2">
              <Label for="calories">Kalorien (kcal) *</Label>
              <Input id="calories" v-model.number="manualCalories" type="number" min="0" step="1" placeholder="z.B. 450" />
            </div>

            <div class="space-y-2">
              <Label>Makros (optional, in Gramm)</Label>
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <Label for="protein" class="text-xs text-muted-foreground">Protein</Label>
                  <Input id="protein" v-model.number="manualProtein" type="number" min="0" step="0.1" placeholder="g" />
                </div>
                <div>
                  <Label for="carbs" class="text-xs text-muted-foreground">Kohlenhydrate</Label>
                  <Input id="carbs" v-model.number="manualCarbs" type="number" min="0" step="0.1" placeholder="g" />
                </div>
                <div>
                  <Label for="fat" class="text-xs text-muted-foreground">Fett</Label>
                  <Input id="fat" v-model.number="manualFat" type="number" min="0" step="0.1" placeholder="g" />
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <Label for="date-manual">Datum</Label>
              <Input id="date-manual" v-model="mealDate" type="date" />
            </div>

            <Button type="submit" class="w-full" size="lg" :disabled="isSubmitting">
              <i v-if="isSubmitting" class="ri-loader-4-line animate-spin" />
              {{ isSubmitting ? 'Wird gespeichert...' : 'Speichern' }}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
