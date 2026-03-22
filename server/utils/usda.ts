// USDA FoodData Central API client
// Docs: https://fdc.nal.usda.gov/api-guide/

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1'

const NUTRIENT_IDS = {
  calories: 1008,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
}

export interface UsdaNutrients {
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  per100g: boolean
  fdcId: number
  description: string
  source: string
}

// Search USDA for a food item, return top candidates
export async function searchUsda(query: string): Promise<any[]> {
  const config = useRuntimeConfig()
  const apiKey = config.usdaApiKey
  if (!apiKey) return []

  try {
    const searchQuery = query.toLowerCase().includes('raw') ? query : `${query} cooked`

    const result = await $fetch<any>(`${USDA_BASE}/foods/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      query: { api_key: apiKey },
      body: {
        query: searchQuery,
        pageSize: 3,
        dataType: ['Foundation', 'SR Legacy'],
      },
    })

    return result?.foods || []
  }
  catch {
    return []
  }
}

function extractNutrients(food: any): UsdaNutrients {
  const nutrients = food.foodNutrients || []

  function get(id: number): number | null {
    const n = nutrients.find((n: any) => n.nutrientId === id)
    return n?.value ?? null
  }

  return {
    calories: get(NUTRIENT_IDS.calories),
    protein: get(NUTRIENT_IDS.protein),
    carbs: get(NUTRIENT_IDS.carbs),
    fat: get(NUTRIENT_IDS.fat),
    per100g: true,
    fdcId: food.fdcId,
    description: food.description,
    source: food.dataType,
  }
}

// Look up multiple food items, then have AI validate the USDA matches
export async function lookupFoods(
  items: Array<{ name: string; portion_grams: number }>,
): Promise<Array<{
  name: string
  usda: UsdaNutrients | null
  scaled: { calories: number; protein: number; carbs: number; fat: number } | null
}>> {
  // Step 1: Search USDA for all items in parallel
  const searchResults = await Promise.all(
    items.map(async (item) => {
      const candidates = await searchUsda(item.name)
      return { item, candidates }
    }),
  )

  // Step 2: AI sanity check — ask which USDA candidates actually match
  const matchIndices = await validateUsdaMatches(
    searchResults.map(r => ({
      query: r.item.name,
      candidates: r.candidates.map(c => c.description),
    })),
  )

  // Step 3: Build results using validated matches
  return searchResults.map((r, i) => {
    const matchIdx = matchIndices[i]
    const matchedFood = matchIdx != null ? r.candidates[matchIdx] : null

    let usda: UsdaNutrients | null = null
    let scaled = null

    if (matchedFood) {
      usda = extractNutrients(matchedFood)
      if (usda.calories != null) {
        const factor = r.item.portion_grams / 100
        scaled = {
          calories: Math.round(usda.calories * factor),
          protein: Math.round((usda.protein ?? 0) * factor),
          carbs: Math.round((usda.carbs ?? 0) * factor),
          fat: Math.round((usda.fat ?? 0) * factor),
        }
      }
    }

    return { name: r.item.name, usda, scaled }
  })
}

// AI validates USDA matches in a single batch call
// Returns an array of indices (which candidate is correct) or null (no match)
async function validateUsdaMatches(
  pairs: Array<{ query: string; candidates: string[] }>,
): Promise<Array<number | null>> {
  // Skip if nothing to validate
  if (pairs.every(p => p.candidates.length === 0)) {
    return pairs.map(() => null)
  }

  const prompt = pairs
    .map((p, i) => {
      if (p.candidates.length === 0) return `${i}. "${p.query}" → no candidates`
      const opts = p.candidates.map((c, j) => `  ${j}: "${c}"`).join('\n')
      return `${i}. "${p.query}":\n${opts}`
    })
    .join('\n\n')

  const schema = {
    name: 'usda_validation',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        matches: {
          type: 'array',
          description: 'For each food item, the index of the best USDA candidate, or -1 if none match',
          items: { type: 'integer' },
        },
      },
      required: ['matches'],
      additionalProperties: false,
    },
  }

  try {
    const { content } = await chatCompletion(
      [
        {
          role: 'user',
          content: `For each food item below, pick the USDA database entry that best matches it.
Return the index of the best candidate for each item. Return -1 if NONE of the candidates are a reasonable match for that food (e.g. "rice" should NOT match "rice crackers").

${prompt}`,
        },
      ],
      { responseFormat: schema, temperature: 0 },
    )

    const parsed = JSON.parse(content)
    return (parsed.matches as number[]).map(idx => (idx === -1 ? null : idx))
  }
  catch {
    // Fallback: use first candidate for each (best effort)
    return pairs.map(p => (p.candidates.length > 0 ? 0 : null))
  }
}
