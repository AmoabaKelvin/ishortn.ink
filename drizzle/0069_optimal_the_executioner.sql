CREATE TABLE `AccountDeletion` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` varchar(32) NOT NULL,
	`email` varchar(255),
	`reason` varchar(64),
	`destination` varchar(64),
	`improvement` text,
	`planSnapshot` enum('free','pro','ultra'),
	`requestedAt` timestamp DEFAULT (now()),
	`restoredAt` timestamp,
	`purgedAt` timestamp,
	CONSTRAINT `AccountDeletion_id` PRIMARY KEY(`id`),
	CONSTRAINT `AccountDeletion_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE INDEX `requestedAt_idx` ON `AccountDeletion` (`requestedAt`);
--> statement-breakpoint
-- New tables default to utf8mb4_0900_ai_ci while User is utf8mb4_unicode_ci, which
-- breaks any join on userId. Same fix as 0033, 0037, 0039, 0055, 0060.
ALTER TABLE `AccountDeletion` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
