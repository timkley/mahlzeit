CREATE TABLE `meals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`description` text NOT NULL,
	`calories` real NOT NULL,
	`protein` real,
	`carbs` real,
	`fat` real,
	`image_key` text,
	`ai_response` text,
	`meal_date` text NOT NULL,
	`meal_time` text,
	`created_at` integer NOT NULL
);
