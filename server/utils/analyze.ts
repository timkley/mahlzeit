// Shared analysis logic: AI result + USDA lookup + merge
// Returns per-100g reference values + portion so the client can recalculate
// Items with source "label" (read from nutrition label) skip USDA entirely.

export async function mergeWithUsda(aiResult: any) {
  // Split items into label-sourced (trust as-is) and estimated (validate via USDA)
  const estimatedItems: Array<{ item: any; originalIndex: number }> = []
  for (let i = 0; i < aiResult.items.length; i++) {
    if (aiResult.items[i].source !== 'label') {
      estimatedItems.push({ item: aiResult.items[i], originalIndex: i })
    }
  }

  // Only call USDA for estimated items
  const usdaResults = estimatedItems.length > 0
    ? await lookupFoods(estimatedItems.map(e => e.item))
    : []

  // Build a map from original index → USDA result
  const usdaByIndex = new Map<number, any>()
  estimatedItems.forEach((e, i) => {
    usdaByIndex.set(e.originalIndex, usdaResults[i])
  })

  const items = aiResult.items.map((aiItem: any, i: number) => {
    // Label items: use AI values directly as per-100g (labels report per 100g)
    if (aiItem.source === 'label') {
      const factor = 100 / (aiItem.portion_grams || 100)
      return {
        name: aiItem.name,
        portion_grams: aiItem.portion_grams,
        per100g: {
          calories: Math.round(aiItem.calories * factor),
          protein: Math.round(aiItem.protein * factor),
          carbs: Math.round(aiItem.carbs * factor),
          fat: Math.round(aiItem.fat * factor),
        },
        source: 'label' as const,
        usda_match: null,
      }
    }

    // Estimated items: use USDA if available, otherwise back-calculate from AI
    const usda = usdaByIndex.get(i)
    const source = usda?.scaled ? 'usda' : 'ai'

    let per100g
    if (usda?.usda && usda.usda.calories != null) {
      per100g = {
        calories: usda.usda.calories,
        protein: usda.usda.protein ?? 0,
        carbs: usda.usda.carbs ?? 0,
        fat: usda.usda.fat ?? 0,
      }
    }
    else {
      const factor = 100 / (aiItem.portion_grams || 100)
      per100g = {
        calories: Math.round(aiItem.calories * factor),
        protein: Math.round(aiItem.protein * factor),
        carbs: Math.round(aiItem.carbs * factor),
        fat: Math.round(aiItem.fat * factor),
      }
    }

    return {
      name: aiItem.name,
      portion_grams: aiItem.portion_grams,
      per100g,
      source,
      usda_match: usda?.usda?.description || null,
    }
  })

  return { items, confidence: aiResult.confidence }
}
