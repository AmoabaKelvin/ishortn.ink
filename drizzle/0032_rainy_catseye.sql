CREATE TABLE IF NOT EXISTS `Team` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`avatarUrl` text,
	`defaultDomain` varchar(255) DEFAULT 'ishortn.ink',
	`ownerId` varchar(32) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `Team_id` PRIMARY KEY(`id`),
	CONSTRAINT `Team_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `TeamInvite` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`teamId` int NOT NULL,
	`email` varchar(255),
	`inviteRole` enum('admin','member') NOT NULL DEFAULT 'member',
	`token` varchar(64) NOT NULL,
	`invitedBy` varchar(32) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`acceptedAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `TeamInvite_id` PRIMARY KEY(`id`),
	CONSTRAINT `TeamInvite_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `TeamMember` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`teamId` int NOT NULL,
	`userId` varchar(32) NOT NULL,
	`role` enum('owner','admin','member') NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `TeamMember_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_team_user` UNIQUE(`teamId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `CustomDomain` ADD `teamId` int;--> statement-breakpoint
ALTER TABLE `Folder` ADD `teamId` int;--> statement-breakpoint
ALTER TABLE `Link` ADD `teamId` int;--> statement-breakpoint
ALTER TABLE `QrCode` ADD `teamId` int;--> statement-breakpoint
ALTER TABLE `SiteSettings` ADD `teamId` int;--> statement-breakpoint
ALTER TABLE `Tag` ADD `teamId` int;--> statement-breakpoint
ALTER TABLE `UtmTemplate` ADD `teamId` int;--> statement-breakpoint
ALTER TABLE `Tag` DROP INDEX `Tag_name_unique`;--> statement-breakpoint
ALTER TABLE `Tag` ADD CONSTRAINT `unique_tag_team` UNIQUE(`name`,`teamId`);--> statement-breakpoint
CREATE INDEX `slug_idx` ON `Team` (`slug`);--> statement-breakpoint
CREATE INDEX `ownerId_idx` ON `Team` (`ownerId`);--> statement-breakpoint
CREATE INDEX `token_idx` ON `TeamInvite` (`token`);--> statement-breakpoint
CREATE INDEX `team_idx` ON `TeamInvite` (`teamId`);--> statement-breakpoint
CREATE INDEX `team_user_idx` ON `TeamMember` (`teamId`,`userId`);--> statement-breakpoint
CREATE INDEX `user_idx` ON `TeamMember` (`userId`);--> statement-breakpoint
CREATE INDEX `teamId_idx` ON `CustomDomain` (`teamId`);--> statement-breakpoint
CREATE INDEX `teamId_idx` ON `Folder` (`teamId`);--> statement-breakpoint
CREATE INDEX `teamId_idx` ON `Link` (`teamId`);--> statement-breakpoint
CREATE INDEX `teamId_idx` ON `QrCode` (`teamId`);--> statement-breakpoint
CREATE INDEX `teamId_idx` ON `SiteSettings` (`teamId`);--> statement-breakpoint
CREATE INDEX `teamId_idx` ON `Tag` (`teamId`);--> statement-breakpoint
CREATE INDEX `teamId_idx` ON `UtmTemplate` (`teamId`);
