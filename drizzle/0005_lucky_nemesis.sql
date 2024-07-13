CREATE TABLE `QrCode` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`qrCode` text,
	`title` varchar(255) DEFAULT '',
	`createdAt` timestamp DEFAULT (now()),
	`userId` varchar(32) NOT NULL,
	`contentType` enum('link','text') NOT NULL,
	`content` text NOT NULL,
	`patternStyle` enum('square','diamond','star','fluid','rounded','tile','stripe','fluid-line','stripe-column') NOT NULL,
	`cornerStyle` enum('circle','circle-diamond','square','square-diamond','rounded-circle','rounded','circle-star') NOT NULL,
	`color` varchar(7) NOT NULL,
	CONSTRAINT `QrCode_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `userId_idx` ON `QrCode` (`userId`);