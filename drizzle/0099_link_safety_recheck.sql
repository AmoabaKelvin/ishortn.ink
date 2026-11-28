CREATE TABLE `LinkSafetyRecheck` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`linkId` int NOT NULL,
	`reason` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `LinkSafetyRecheck_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `linkId_idx` ON `LinkSafetyRecheck` (`linkId`);--> statement-breakpoint
CREATE INDEX `createdAt_idx` ON `LinkSafetyRecheck` (`createdAt`);