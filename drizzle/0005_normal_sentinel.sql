CREATE TABLE `QrCode` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`linkId` int NOT NULL,
	`qrCode` text,
	`title` varchar(255) DEFAULT '',
	`createdAt` timestamp DEFAULT (now()),
	`userId` varchar(32) NOT NULL,
	`qrPatternType` enum('dots','squares','fluid'),
	`qrForegroundColor` varchar(255) DEFAULT '#000000',
	`qrEyesColor` varchar(255) DEFAULT '#000000',
	`qrEyesBorderRadius` int DEFAULT 0,
	CONSTRAINT `QrCode_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `linkId_idx` ON `QrCode` (`linkId`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `QrCode` (`userId`);