CREATE TABLE `Campaign` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`startDate` timestamp,
	`endDate` timestamp,
	`utmSource` varchar(255),
	`utmMedium` varchar(255),
	`utmTerm` varchar(255),
	`utmContent` varchar(255),
	`userId` varchar(32) NOT NULL,
	`teamId` int,
	`createdByUserId` varchar(32),
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `Campaign_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `Link` ADD `campaignId` int;--> statement-breakpoint
CREATE INDEX `userId_idx` ON `Campaign` (`userId`);--> statement-breakpoint
CREATE INDEX `teamId_idx` ON `Campaign` (`teamId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `Campaign` (`status`);--> statement-breakpoint
CREATE INDEX `campaignId_idx` ON `Link` (`campaignId`);