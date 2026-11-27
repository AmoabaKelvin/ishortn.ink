CREATE TABLE `MonthlyUsageSnapshot` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` varchar(32) NOT NULL,
	`month` char(7) NOT NULL,
	`recordedEventCount` int NOT NULL DEFAULT 0,
	`droppedEventCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `MonthlyUsageSnapshot_id` PRIMARY KEY(`id`),
	CONSTRAINT `monthlyUsageSnapshot_userId_month_unique` UNIQUE(`userId`,`month`)
);
--> statement-breakpoint
CREATE INDEX `monthlyUsageSnapshot_month_idx` ON `MonthlyUsageSnapshot` (`month`);