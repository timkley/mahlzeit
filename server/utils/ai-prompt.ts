// Prompts for food analysis — structured outputs handle the JSON format,
// so we just need to tell the model what to do, not how to format it.

export function buildFoodAnalysisPrompt(description?: string): string {
  const descPart = description
    ? `The user describes this meal as: "${description}".`
    : ''

  return `You are a nutritionist assistant. Analyze this food image and estimate the nutritional content.
${descPart}

IMPORTANT — Nutrition label detection:
If the image shows a product package or nutrition label (Nährwerttabelle / Nutrition Facts), you MUST:
- Read the exact values printed on the label — do NOT estimate or guess.
- Use the per-100g values from the label if available, otherwise use per-serving values.
- Set source to "label" for each item whose data comes from the label.
- Set portion_grams to 100 when reporting per-100g label values.
- Only report values you can clearly read. If a value is unreadable, use 0.

If the image shows actual food (not a package), estimate as usual and set source to "estimate":
1. Identify each food item visible in the image
2. Estimate portion sizes in grams
3. Calculate calories and macros per item using standard nutritional data
4. Sum up the totals`
}

export function buildTextAnalysisPrompt(description: string): string {
  return `You are a nutritionist assistant. Estimate the nutritional content for this meal:

"${description}"

The description may be in German. Handle common German food names and portion descriptions
(e.g. "eine Scheibe Brot", "ein Teller Nudeln", "ein Glas Bier").

1. Identify each food item
2. Estimate portion sizes in grams
3. Calculate calories and macros per item
4. Sum up the totals

Set source to "estimate" for every item.`
}

// JSON schema enforced by OpenRouter structured outputs
export const foodAnalysisSchema = {
  name: 'food_analysis',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'Individual food items identified',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Food item name' },
            portion_grams: { type: 'number', description: 'Estimated portion in grams' },
            calories: { type: 'number', description: 'Estimated calories (kcal)' },
            protein: { type: 'number', description: 'Protein in grams' },
            carbs: { type: 'number', description: 'Carbohydrates in grams' },
            fat: { type: 'number', description: 'Fat in grams' },
            source: { type: 'string', enum: ['label', 'estimate'], description: '"label" if values were read from a nutrition label, "estimate" if AI-estimated' },
          },
          required: ['name', 'portion_grams', 'calories', 'protein', 'carbs', 'fat', 'source'],
          additionalProperties: false,
        },
      },
      total: {
        type: 'object',
        description: 'Sum of all items',
        properties: {
          calories: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
        },
        required: ['calories', 'protein', 'carbs', 'fat'],
        additionalProperties: false,
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Confidence level of the estimate',
      },
    },
    required: ['items', 'total', 'confidence'],
    additionalProperties: false,
  },
}
