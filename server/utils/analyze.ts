// Shared analysis logic: AI result + USDA lookup + merge
// Returns per-100g reference values + portion so the client can recalculate

export async function mergeWithUsda(aiResult: any) {
  const usdaResults = await lookupFoods(aiResult.items)

  const items = aiResult.items.map((aiItem: any, i: number) => {
    const usda = usdaResults[i]
    const source = usda?.scaled ? 'usda' : 'ai'

    // Per-100g values: use USDA if available, otherwise back-calculate from AI
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
      // Back-calculate AI estimates to per-100g
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
