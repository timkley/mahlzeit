// POST /api/analyze/image
// AI identifies items from photo → USDA validates + provides values → merge

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.image) {
    throw createError({ statusCode: 400, message: 'image is required (base64)' })
  }

  const imageUrl = body.image.startsWith('data:')
    ? body.image
    : `data:image/jpeg;base64,${body.image}`

  const { content, model } = await chatCompletion(
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildFoodAnalysisPrompt(body.description) },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      },
    ],
    { responseFormat: foodAnalysisSchema },
  )

  const analysis = await mergeWithUsda(JSON.parse(content))
  return { analysis, model, raw: content }
})
