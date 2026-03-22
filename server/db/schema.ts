import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// This is like a Laravel migration + Eloquent model combined.
// Drizzle uses this single definition for:
//   1. Generating SQL migrations (like `php artisan make:migration`)
//   2. Type-safe queries (like Eloquent, but with full TypeScript types)

export const meals = sqliteTable('meals', {
  // Primary key — auto-incrementing integer, like $table->id() in Laravel
  id: integer().primaryKey({ autoIncrement: true }),

  // What was eaten — required text field
  description: text().notNull(),

  // Final calorie count (user may adjust the AI estimate)
  calories: real().notNull(),

  // Optional macronutrient breakdown (grams)
  protein: real(),
  carbs: real(),
  fat: real(),

  // R2 storage key for the food photo (null for text-only entries)
  // Like storing an S3 key in Laravel
  imageKey: text('image_key'),

  // Raw AI JSON response — kept for debugging and prompt improvement
  aiResponse: text('ai_response'),

  // When the meal was eaten — stored as YYYY-MM-DD string
  // (D1/SQLite doesn't have a native date type, so we use text)
  mealDate: text('meal_date').notNull(),

  // Meal category: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  mealTime: text('meal_time'),

  // Unix timestamp — like $table->timestamp('created_at')
  // `mode: 'timestamp'` means Drizzle auto-converts to/from JS Date objects
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})
