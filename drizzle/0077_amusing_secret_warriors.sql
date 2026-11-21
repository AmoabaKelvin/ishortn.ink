CREATE TABLE `LinkCreationFailure` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`source` enum('dashboard','bulk','api') NOT NULL,
	`step` enum('validation','safety','metadata','db') NOT NULL,
	`code` varchar(64) NOT NULL,
	`serverError` boolean NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `LinkCreationFailure_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `createdAt_idx` ON `LinkCreationFailure` (`createdAt`);