ALTER TABLE `Subscription` ADD `plan` enum('free','pro','ultra') DEFAULT 'free';--> statement-breakpoint
ALTER TABLE `Subscription` ADD `variantId` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `Subscription` ADD `productId` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `User` ADD `monthlyEventCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `User` ADD `lastEventCountReset` timestamp DEFAULT (now());--> statement-breakpoint
ALTER TABLE `User` ADD `eventUsageAlertLevel` int DEFAULT 0;