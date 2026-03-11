CREATE TABLE `Feedback` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` varchar(32) NOT NULL,
	`feedbackType` enum('bug','feature','question') NOT NULL,
	`message` text NOT NULL,
	`imageUrls` json DEFAULT ('[]'),
	`feedbackStatus` enum('open','resolved','dismissed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `Feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `userId_idx` ON `Feedback` (`userId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `Feedback` (`feedbackStatus`);