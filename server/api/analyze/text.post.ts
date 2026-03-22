// POST /api/analyze/text
// AI identifies items from description → USDA validates + provides values → merge

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.description) {
    throw createError({ statusCode: 400, message: 'description is required' })
  }

  const { content, model } = await chatCompletion(
    [{ role: 'user', content: buildTextAnalysisPrompt(body.description) }],
    { responseFormat: foodAnalysisSchema },
  )

  const analysis = await mergeWithUsda(JSON.parse(content))
  return { analysis, model, raw: content }
})
