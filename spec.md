# SPEC.md — Calorie Tracker Product Specification

## Purpose

A personal calorie tracking app for a single user (my wife). She wants to quickly log meals — either by snapping a photo of her food or typing what she ate — and see her daily calorie total. AI estimates calories from photos and text descriptions. She can adjust the AI's estimate if it's off.

## User

- Single user, no registration needed
- Auth: Cloudflare Access (Zero Trust, email OTP) or simple password middleware
- German-speaking, phone as primary device

## Core Features (v1)

### 1. Daily Dashboard (`/`)
- Shows **today's date** and **total calories so far**
- Visual progress indicator (e.g., progress bar toward daily goal, default 2000 kcal)
- List of today's meals as cards (meal name, calories, optional thumbnail)
- Big prominent **"+ Mahlzeit hinzufügen"** button
- Quick navigation to previous/next day

### 2. Add Meal (`/add`)
- Two input methods, can be combined:
  - **Photo**: Camera capture or file picker. Image is resized client-side to max 1200px before upload.
  - **Text**: Free text field, e.g. "Hähnchenbrust mit Reis und Salat"
- Submit triggers AI analysis:
  - If photo provided → send to Workers AI vision model with optional text as context
  - If text only → send to Workers AI text model for calorie estimation
- AI returns: list of identified food items, estimated calories per item, total
- User sees the AI estimate and can:
  - **Accept** as-is (one tap)
  - **Adjust** total calories manually (number input)
  - **Edit** individual items (stretch goal)
- Meal type selector: Frühstück / Mittagessen / Abendessen / Snack
- Save stores: description, calories, macros (if available), image in R2, AI raw response

### 3. History (`/history`)
- Calendar or scrollable list view of past days
- Each day shows: date, total calories, meal count
- Tap a day to see its meals
- Simple — no charts or analytics in v1

### 4. Meal Detail (`/meal/[id]`)
- Full view of a single meal entry
- Shows: image (if present), description, calories, macros, AI's original estimate
- Edit button to adjust calories/description
- Delete button with confirmation

## Non-Features (explicitly out of scope for v1)

- No user registration / multi-user support
- No barcode scanning
- No recipe database or food search autocomplete
- No weekly/monthly charts or reports
- No meal planning or suggestions
- No notifications or reminders
- No data export
- No PWA / offline support (nice-to-have for v2)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/meals?date=YYYY-MM-DD` | List meals for a date (default: today) |
| POST | `/api/meals` | Create new meal entry |
| GET | `/api/meals/:id` | Get single meal |
| PUT | `/api/meals/:id` | Update meal (edit calories, description) |
| DELETE | `/api/meals/:id` | Delete meal |
| POST | `/api/analyze/image` | Send photo + optional text → get AI calorie estimate |
| POST | `/api/analyze/text` | Send text description → get AI calorie estimate |
| GET | `/api/stats/daily?date=YYYY-MM-DD` | Daily summary (total calories, macros, meal count) |

## Data Model

### meals table
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Primary key, auto-increment |
| description | TEXT | What was eaten (user text or AI-generated) |
| calories | REAL | Final calorie count (user may have adjusted) |
| protein | REAL | Grams, nullable |
| carbs | REAL | Grams, nullable |
| fat | REAL | Grams, nullable |
| image_key | TEXT | R2 object key, nullable |
| ai_response | TEXT | Raw AI JSON response for transparency |
| meal_date | TEXT | ISO date YYYY-MM-DD |
| meal_time | TEXT | 'breakfast' / 'lunch' / 'dinner' / 'snack' |
| created_at | INTEGER | Unix timestamp |

### settings table (optional, for daily goal)
| Column | Type | Notes |
|--------|------|-------|
| key | TEXT | Primary key, e.g. 'daily_calorie_goal' |
| value | TEXT | JSON value |

## AI Integration Details

### Image Analysis
- Model: `@cf/meta/llama-3.2-11b-vision-instruct`
- Input: base64 image + optional text description
- Output: JSON with food items, portions, calories, macros, confidence level
- Prompt uses chain-of-thought: identify items → estimate portions → calculate calories → sum totals
- Temperature: 0.3 (for consistency)
- Max tokens: 1024

### Text-Only Analysis
- Model: `@cf/meta/llama-3.2-11b-vision-instruct` (same model, text-only prompt) or a smaller text model
- Input: meal description in German or English
- Output: same JSON structure as image analysis
- Should handle German food names and portion descriptions ("eine Scheibe Brot", "ein Teller Nudeln")

### Accuracy Expectations
- ±15-25% for simple, recognizable foods — this is fine for personal tracking
- UI should always make it easy to manually correct
- Store AI's raw response so we can improve prompts over time

## UI/UX Guidelines

- **Mobile-first**: Designed for phone use, thumb-reachable action buttons
- **Fast**: Logging a meal should take <30 seconds
- **Forgiving**: Easy to edit or delete entries
- **German UI**: All labels and text in German
- **Clean typography**: Large numbers for calorie totals, readable food descriptions
- **Color coding**: Green (under goal), yellow (approaching), red (over goal) for daily progress
- **Dark mode**: Support system preference

## Technical Constraints

- Workers AI vision calls are remote-only (even in local dev)
- 128 MB memory per isolate — don't buffer multiple images
- Client-side image resizing before upload (max 1200px width, JPEG quality 0.8)
- D1 has 10 GB database limit — irrelevant for single-user, but good to know
- R2 free tier: 10 GB storage — enough for thousands of meal photos

## Success Criteria

The app is done when my wife can:
1. Open the app on her phone
2. Take a photo of her lunch
3. See an AI estimate of the calories within 5 seconds
4. Adjust the number if needed and save
5. See her daily total on the home screen
6. Browse back to see what she ate yesterday
