CREATE TABLE `PlanLimitHit` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` varchar(32) NOT NULL,
	`limitKey` varchar(64) NOT NULL,
	`plan` enum('free','pro','ultra') NOT NULL,
	`day` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `PlanLimitHit_id` PRIMARY KEY(`id`),
	CONSTRAINT `userId_limitKey_day_unique` UNIQUE(`userId`,`limitKey`,`day`)
);
--> statement-breakpoint
CREATE INDEX `limitKey_createdAt_idx` ON `PlanLimitHit` (`limitKey`,`createdAt`);