CREATE TABLE `AudienceFeedback` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` varchar(32) NOT NULL,
	`role` varchar(64),
	`useCase` varchar(64),
	`monthlyVolume` varchar(64),
	`acquisitionChannel` varchar(64),
	`acquisitionDetail` text,
	`priorTool` varchar(64),
	`switchReason` text,
	`magicFeature` varchar(64),
	`upgradeReason` varchar(64),
	`upgradeBlocker` text,
	`improvementWish` text,
	`planSnapshot` enum('free','pro','ultra'),
	`submittedAt` timestamp,
	`dismissedAt` timestamp,
	`dismissCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `AudienceFeedback_id` PRIMARY KEY(`id`),
	CONSTRAINT `AudienceFeedback_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE INDEX `userId_idx` ON `AudienceFeedback` (`userId`);--> statement-breakpoint
CREATE INDEX `submittedAt_idx` ON `AudienceFeedback` (`submittedAt`);