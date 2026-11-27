CREATE TABLE `ScheduledReport` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` varchar(32) NOT NULL,
	`teamId` int,
	`createdBy` varchar(32),
	`targetType` enum('link','folder','campaign') NOT NULL,
	`targetId` int NOT NULL,
	`frequency` enum('weekly','monthly') NOT NULL,
	`recipients` json NOT NULL,
	`unsubscribed` json,
	`lastPeriodKey` varchar(16),
	`lastSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ScheduledReport_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `scheduledReport_userId_idx` ON `ScheduledReport` (`userId`);--> statement-breakpoint
CREATE INDEX `scheduledReport_teamId_idx` ON `ScheduledReport` (`teamId`);--> statement-breakpoint
CREATE INDEX `scheduledReport_target_idx` ON `ScheduledReport` (`targetType`,`targetId`);--> statement-breakpoint
CREATE INDEX `scheduledReport_due_idx` ON `ScheduledReport` (`frequency`,`lastPeriodKey`);