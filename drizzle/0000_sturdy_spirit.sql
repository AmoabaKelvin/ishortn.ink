CREATE TABLE IF NOT EXISTS `Link` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`url` text,
	`alias` varchar(20),
	`createdAt` timestamp DEFAULT (now()),
	`disableLinkAfterClicks` int,
	`disableLinkAfterDate` datetime,
	`disabled` boolean DEFAULT false,
	`publicStats` boolean DEFAULT false,
	`userId` varchar(32) NOT NULL,
	CONSTRAINT `Link_id` PRIMARY KEY(`id`),
	CONSTRAINT `Link_alias_unique` UNIQUE(`alias`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `LinkVisit` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`linkId` int NOT NULL,
	`device` varchar(255),
	`browser` varchar(255),
	`os` varchar(255),
	`model` varchar(255) DEFAULT '',
	`country` varchar(255),
	`city` varchar(255),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `LinkVisit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `Token` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`token` text,
	`createdAt` timestamp DEFAULT (now()),
	`userId` varchar(32) NOT NULL,
	CONSTRAINT `Token_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `User` (
	`id` varchar(32) NOT NULL,
	`name` varchar(255),
	`email` varchar(255),
	`createdAt` timestamp DEFAULT (now()),
	`imageUrl` text,
	CONSTRAINT `User_id` PRIMARY KEY(`id`),
	CONSTRAINT `User_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `userId_idx` ON `Link` (`userId`);--> statement-breakpoint
CREATE INDEX `linkId_idx` ON `LinkVisit` (`linkId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `Token` (`userId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `User` (`id`);