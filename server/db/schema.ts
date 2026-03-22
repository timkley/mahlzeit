import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const meals = sqliteTable('meals', {
  id: integer().primaryKey({ autoIncrement: true }),
  userEmail: text('user_email').notNull(),
  description: text().notNull(),
  calories: real().notNull(),
  protein: real(),
  carbs: real(),
  fat: real(),
  imageKey: text('image_key'),
  aiResponse: text('ai_response'),
  mealDate: text('meal_date').notNull(),
  mealTime: text('meal_time'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

// Per-user key-value settings (e.g. daily calorie goal)
export const settings = sqliteTable('settings', {
  userEmail: text('user_email').notNull(),
  key: text().notNull(),
  value: text().notNull(),
}, (table) => [
  { columns: [table.userEmail, table.key], unique: true },
])
