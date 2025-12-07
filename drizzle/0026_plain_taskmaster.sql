CREATE TABLE `Folder` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`userId` varchar(32) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `Folder_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `Link` ADD `folderId` int;--> statement-breakpoint
CREATE INDEX `userId_idx` ON `Folder` (`userId`);--> statement-breakpoint
CREATE INDEX `folderId_idx` ON `Link` (`folderId`);