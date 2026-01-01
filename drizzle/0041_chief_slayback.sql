CREATE TABLE `QrPreset` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`userId` varchar(32) NOT NULL,
	`teamId` int,
	`pixelStyle` varchar(50) NOT NULL DEFAULT 'rounded',
	`markerShape` varchar(50) NOT NULL DEFAULT 'square',
	`markerInnerShape` varchar(50) NOT NULL DEFAULT 'auto',
	`darkColor` varchar(9) NOT NULL DEFAULT '#000000',
	`lightColor` varchar(9) NOT NULL DEFAULT '#ffffff',
	`effect` varchar(50) NOT NULL DEFAULT 'none',
	`effectRadius` int NOT NULL DEFAULT 12,
	`marginNoise` boolean NOT NULL DEFAULT false,
	`marginNoiseRate` varchar(10) NOT NULL DEFAULT '0.5',
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `QrPreset_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `userId_idx` ON `QrPreset` (`userId`);--> statement-breakpoint
CREATE INDEX `teamId_idx` ON `QrPreset` (`teamId`);