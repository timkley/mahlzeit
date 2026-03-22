import { db, schema } from 'hub:db'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const email = getUserEmail(event)
  const id = Number(getRouterParam(event, 'id'))

  const [deleted] = await db
    .delete(schema.meals)
    .where(and(
      eq(schema.meals.id, id),
      eq(schema.meals.userEmail, email),
    ))
    .returning()

  if (!deleted) {
    throw createError({ statusCode: 404, message: 'Meal not found' })
  }

  return { success: true }
})
