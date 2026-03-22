import { db, schema } from 'hub:db'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const email = getUserEmail(event)

  const [row] = await db
    .select()
    .from(schema.settings)
    .where(and(
      eq(schema.settings.userEmail, email),
      eq(schema.settings.key, 'daily_calorie_goal'),
    ))

  return { goal: row ? Number(row.value) : 2000 }
})
