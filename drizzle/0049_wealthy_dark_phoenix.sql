CREATE TABLE `BlockedDomain` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`domain` varchar(255) NOT NULL,
	`reason` varchar(255),
	`createdAt` timestamp DEFAULT (now()),
	`createdByUserId` varchar(32),
	CONSTRAINT `BlockedDomain_id` PRIMARY KEY(`id`),
	CONSTRAINT `BlockedDomain_domain_unique` UNIQUE(`domain`)
);
--> statement-breakpoint
CREATE TABLE `FlaggedLink` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`linkId` int NOT NULL,
	`reason` varchar(255),
	`flagStatus` enum('pending','blocked','dismissed') NOT NULL DEFAULT 'pending',
	`flaggedAt` timestamp DEFAULT (now()),
	`resolvedAt` timestamp,
	`resolvedByUserId` varchar(32),
	CONSTRAINT `FlaggedLink_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `Link` ADD `blocked` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `Link` ADD `blockedAt` timestamp;--> statement-breakpoint
ALTER TABLE `Link` ADD `blockedReason` varchar(255);--> statement-breakpoint
ALTER TABLE `User` ADD `isAdmin` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `User` ADD `banned` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `User` ADD `bannedAt` timestamp;--> statement-breakpoint
ALTER TABLE `User` ADD `bannedReason` varchar(255);--> statement-breakpoint
CREATE INDEX `domain_idx` ON `BlockedDomain` (`domain`);--> statement-breakpoint
CREATE INDEX `linkId_idx` ON `FlaggedLink` (`linkId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `FlaggedLink` (`flagStatus`);