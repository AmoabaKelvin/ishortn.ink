CREATE TABLE `FolderPermission` (
	`folderId` int NOT NULL,
	`userId` varchar(32) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `FolderPermission_folderId_userId_pk` PRIMARY KEY(`folderId`,`userId`)
);
--> statement-breakpoint
CREATE INDEX `folderId_idx` ON `FolderPermission` (`folderId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `FolderPermission` (`userId`);