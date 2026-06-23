CREATE TABLE `BioBlock` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`bioPageId` int NOT NULL,
	`blockType` enum('link','heading','text','social','divider','email') NOT NULL,
	`title` varchar(255),
	`content` text,
	`url` text,
	`linkId` int,
	`position` int NOT NULL DEFAULT 0,
	`isVisible` boolean NOT NULL DEFAULT true,
	`scheduledAt` datetime,
	`scheduledUntil` datetime,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `BioBlock_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `BioPage` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` varchar(32) NOT NULL,
	`teamId` int,
	`createdByUserId` varchar(32),
	`slug` varchar(100) NOT NULL,
	`title` varchar(255),
	`description` text,
	`avatarUrl` text,
	`theme` json,
	`socialImageUrl` text,
	`seoTitle` varchar(255),
	`seoDescription` varchar(500),
	`customDomain` varchar(255),
	`removeBranding` boolean DEFAULT false,
	`isPublished` boolean DEFAULT false,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `BioPage_id` PRIMARY KEY(`id`),
	CONSTRAINT `bio_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `bio_custom_domain_unique` UNIQUE(`customDomain`)
);
--> statement-breakpoint
CREATE TABLE `BioPageView` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`bioPageId` int NOT NULL,
	`device` varchar(255),
	`browser` varchar(255),
	`os` varchar(255),
	`model` varchar(255) DEFAULT '',
	`referer` varchar(255),
	`country` varchar(255),
	`city` varchar(255),
	`continent` varchar(255) DEFAULT 'N/A',
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `BioPageView_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `BioPageViewDailySummary` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`bioPageId` int NOT NULL,
	`date` date NOT NULL,
	`views` int NOT NULL DEFAULT 0,
	`uniqueViews` int NOT NULL DEFAULT 0,
	CONSTRAINT `BioPageViewDailySummary_id` PRIMARY KEY(`id`),
	CONSTRAINT `bio_page_date_unique` UNIQUE(`bioPageId`,`date`)
);
--> statement-breakpoint
CREATE TABLE `UniqueBioPageView` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`bioPageId` int NOT NULL,
	`ipHash` char(64) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `UniqueBioPageView_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_bio_view_idx` UNIQUE(`bioPageId`,`ipHash`)
);
--> statement-breakpoint
ALTER TABLE `Link` ADD `isBioLink` boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX `bioPageId_idx` ON `BioBlock` (`bioPageId`);--> statement-breakpoint
CREATE INDEX `position_idx` ON `BioBlock` (`bioPageId`,`position`);--> statement-breakpoint
CREATE INDEX `linkId_idx` ON `BioBlock` (`linkId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `BioPage` (`userId`);--> statement-breakpoint
CREATE INDEX `teamId_idx` ON `BioPage` (`teamId`);--> statement-breakpoint
CREATE INDEX `isPublished_idx` ON `BioPage` (`isPublished`);--> statement-breakpoint
CREATE INDEX `bioPageId_idx` ON `BioPageView` (`bioPageId`);--> statement-breakpoint
CREATE INDEX `bioPageId_createdAt_idx` ON `BioPageView` (`bioPageId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `createdAt_idx` ON `BioPageView` (`createdAt`);--> statement-breakpoint
CREATE INDEX `bioPageId_idx` ON `UniqueBioPageView` (`bioPageId`);--> statement-breakpoint
CREATE INDEX `bioPageId_createdAt_idx` ON `UniqueBioPageView` (`bioPageId`,`createdAt`);