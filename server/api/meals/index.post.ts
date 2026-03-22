import { db, schema } from 'hub:db'

export default defineEventHandler(async (event) => {
  const email = getUserEmail(event)
  const body = await readBody(event)

  if (!body.description || !body.calories) {
    throw createError({ statusCode: 400, message: 'description and calories are required' })
  }

  const [meal] = await db
    .insert(schema.meals)
    .values({
      userEmail: email,
      description: body.description,
      calories: Number(body.calories),
      protein: body.protein ? Number(body.protein) : null,
      carbs: body.carbs ? Number(body.carbs) : null,
      fat: body.fat ? Number(body.fat) : null,
      mealDate: body.mealDate,
      mealTime: body.mealTime,
      aiResponse: body.aiResponse || null,
    })
    .returning()

  return meal
})
