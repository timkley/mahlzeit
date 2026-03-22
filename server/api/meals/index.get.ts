import { db, schema } from 'hub:db'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const email = getUserEmail(event)
  const query = getQuery(event)
  const date = (query.date as string) || new Date().toISOString().slice(0, 10)

  return await db
    .select()
    .from(schema.meals)
    .where(and(
      eq(schema.meals.userEmail, email),
      eq(schema.meals.mealDate, date),
    ))
})
