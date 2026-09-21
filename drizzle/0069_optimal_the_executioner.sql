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
-- Match User's collation so joins on userId work (same fix as 0060).
ALTER TABLE `AccountDeletion` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
