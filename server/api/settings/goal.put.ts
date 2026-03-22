import { db, schema } from 'hub:db'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const email = getUserEmail(event)
  const body = await readBody(event)

  if (!body.goal || body.goal < 1) {
    throw createError({ statusCode: 400, message: 'goal must be a positive number' })
  }

  // Upsert: insert or update
  const [existing] = await db
    .select()
    .from(schema.settings)
    .where(and(
      eq(schema.settings.userEmail, email),
      eq(schema.settings.key, 'daily_calorie_goal'),
    ))

  if (existing) {
    await db
      .update(schema.settings)
      .set({ value: String(body.goal) })
      .where(and(
        eq(schema.settings.userEmail, email),
        eq(schema.settings.key, 'daily_calorie_goal'),
      ))
  }
  else {
    await db
      .insert(schema.settings)
      .values({
        userEmail: email,
        key: 'daily_calorie_goal',
        value: String(body.goal),
      })
  }

  return { goal: Number(body.goal) }
})
