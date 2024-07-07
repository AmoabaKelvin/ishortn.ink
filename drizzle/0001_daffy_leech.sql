CREATE TABLE `Subscription` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` varchar(32) NOT NULL,
	`orderId` int DEFAULT 0,
	`subscriptionId` int DEFAULT 0,
	`customerId` int DEFAULT 0,
	`renewsAt` datetime,
	`createdAt` timestamp,
	`status` varchar(255) DEFAULT '',
	`cardBrand` varchar(255) DEFAULT '',
	`cardLastFour` varchar(4) DEFAULT '',
	CONSTRAINT `Subscription_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `userId_idx` ON `Subscription` (`userId`);