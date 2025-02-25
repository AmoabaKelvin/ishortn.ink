CREATE TABLE `LinkTag` (
	`linkId` int NOT NULL,
	`tagId` int NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `LinkTag_linkId_tagId_pk` PRIMARY KEY(`linkId`,`tagId`)
);
--> statement-breakpoint
CREATE TABLE `Tag` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	`userId` varchar(32) NOT NULL,
	CONSTRAINT `Tag_id` PRIMARY KEY(`id`),
	CONSTRAINT `Tag_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE INDEX `linkId_idx` ON `LinkTag` (`linkId`);--> statement-breakpoint
CREATE INDEX `tagId_idx` ON `LinkTag` (`tagId`);--> statement-breakpoint
CREATE INDEX `name_idx` ON `Tag` (`name`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `Tag` (`userId`);