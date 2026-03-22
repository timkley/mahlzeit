import { db, schema } from 'hub:db'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const email = getUserEmail(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)

  const [updated] = await db
    .update(schema.meals)
    .set({
      description: body.description,
      calories: Number(body.calories),
      protein: body.protein != null ? Number(body.protein) : null,
      carbs: body.carbs != null ? Number(body.carbs) : null,
      fat: body.fat != null ? Number(body.fat) : null,
      mealTime: body.mealTime,
    })
    .where(and(
      eq(schema.meals.id, id),
      eq(schema.meals.userEmail, email),
    ))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, message: 'Meal not found' })
  }

  return updated
})
