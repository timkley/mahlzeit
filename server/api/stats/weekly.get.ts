import { db, schema } from 'hub:db'
import { sql, and, eq, gte, lte } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const email = getUserEmail(event)
  const query = getQuery(event)
  const endDate = (query.date as string) || new Date().toISOString().slice(0, 10)

  const end = new Date(endDate + 'T12:00:00')
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  const startDate = start.toISOString().slice(0, 10)

  const rows = await db
    .select({
      date: schema.meals.mealDate,
      calories: sql<number>`coalesce(sum(${schema.meals.calories}), 0)`.as('calories'),
      protein: sql<number>`coalesce(sum(${schema.meals.protein}), 0)`.as('protein'),
      carbs: sql<number>`coalesce(sum(${schema.meals.carbs}), 0)`.as('carbs'),
      fat: sql<number>`coalesce(sum(${schema.meals.fat}), 0)`.as('fat'),
      count: sql<number>`count(*)`.as('count'),
    })
    .from(schema.meals)
    .where(and(
      eq(schema.meals.userEmail, email),
      gte(schema.meals.mealDate, startDate),
      lte(schema.meals.mealDate, endDate),
    ))
    .groupBy(schema.meals.mealDate)
    .orderBy(schema.meals.mealDate)

  const byDate = new Map(rows.map(r => [r.date, r]))
  const days = []
  const cursor = new Date(start)
  for (let i = 0; i < 7; i++) {
    const d = cursor.toISOString().slice(0, 10)
    const row = byDate.get(d)
    days.push({
      date: d,
      calories: row?.calories ?? 0,
      protein: row?.protein ?? 0,
      carbs: row?.carbs ?? 0,
      fat: row?.fat ?? 0,
      count: row?.count ?? 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  const daysWithData = days.filter(d => d.count > 0)
  const avgCount = daysWithData.length || 1
  const avg = {
    calories: Math.round(daysWithData.reduce((s, d) => s + d.calories, 0) / avgCount),
    protein: Math.round(daysWithData.reduce((s, d) => s + d.protein, 0) / avgCount),
    carbs: Math.round(daysWithData.reduce((s, d) => s + d.carbs, 0) / avgCount),
    fat: Math.round(daysWithData.reduce((s, d) => s + d.fat, 0) / avgCount),
  }

  return { days, avg, daysWithData: daysWithData.length }
})
