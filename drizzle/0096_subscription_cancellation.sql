CREATE TABLE `SubscriptionCancellation` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` varchar(32) NOT NULL,
	`subscriptionId` int NOT NULL,
	`fromPlan` enum('free','pro','ultra') NOT NULL,
	`toPlan` enum('free','pro','ultra') NOT NULL,
	`billingInterval` enum('monthly','annual') NOT NULL,
	`variantId` int,
	`reason` varchar(64) NOT NULL,
	`feedback` text,
	`offerShown` enum('pause','none') NOT NULL,
	`outcome` enum('cancelled','paused','downgraded') NOT NULL,
	`pauseMonths` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `SubscriptionCancellation_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `Subscription` ADD `pausedUntil` datetime;--> statement-breakpoint
CREATE INDEX `subscriptionCancellation_createdAt_idx` ON `SubscriptionCancellation` (`createdAt`);--> statement-breakpoint
CREATE INDEX `subscriptionCancellation_userId_idx` ON `SubscriptionCancellation` (`userId`);