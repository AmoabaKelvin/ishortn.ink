CREATE TABLE `AccountTransfer` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`fromUserId` varchar(32) NOT NULL,
	`toEmail` varchar(255) NOT NULL,
	`toUserId` varchar(32),
	`token` varchar(64) NOT NULL,
	`status` enum('pending','accepted','cancelled','expired') NOT NULL DEFAULT 'pending',
	`linksCount` int NOT NULL DEFAULT 0,
	`customDomainsCount` int NOT NULL DEFAULT 0,
	`qrCodesCount` int NOT NULL DEFAULT 0,
	`foldersCount` int NOT NULL DEFAULT 0,
	`tagsCount` int NOT NULL DEFAULT 0,
	`utmTemplatesCount` int NOT NULL DEFAULT 0,
	`qrPresetsCount` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp NOT NULL,
	`acceptedAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `AccountTransfer_id` PRIMARY KEY(`id`),
	CONSTRAINT `AccountTransfer_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `User` ADD `deletedAt` timestamp;--> statement-breakpoint
CREATE INDEX `token_idx` ON `AccountTransfer` (`token`);--> statement-breakpoint
CREATE INDEX `fromUser_idx` ON `AccountTransfer` (`fromUserId`);--> statement-breakpoint
CREATE INDEX `toEmail_idx` ON `AccountTransfer` (`toEmail`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `AccountTransfer` (`status`);--> statement-breakpoint
CREATE INDEX `deletedAt_idx` ON `User` (`deletedAt`);