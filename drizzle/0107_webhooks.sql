CREATE TABLE `Webhook` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` varchar(32) NOT NULL,
	`teamId` int,
	`url` varchar(2048) NOT NULL,
	`description` varchar(255),
	`events` json NOT NULL,
	`secret` varchar(80) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`consecutiveFailures` int NOT NULL DEFAULT 0,
	`lastFailureAt` timestamp,
	`disabledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `Webhook_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `WebhookDelivery` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`webhookId` int NOT NULL,
	`eventId` varchar(40) NOT NULL,
	`eventType` varchar(32) NOT NULL,
	`payload` text NOT NULL,
	`status` enum('pending','succeeded','failed') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`responseStatus` int,
	`durationMs` int,
	`error` varchar(255),
	`nextAttemptAt` timestamp,
	`lastAttemptAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `WebhookDelivery_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `webhook_userId_idx` ON `Webhook` (`userId`);--> statement-breakpoint
CREATE INDEX `webhook_teamId_idx` ON `Webhook` (`teamId`);--> statement-breakpoint
CREATE INDEX `webhookDelivery_webhookId_createdAt_idx` ON `WebhookDelivery` (`webhookId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `webhookDelivery_eventId_idx` ON `WebhookDelivery` (`eventId`);--> statement-breakpoint
CREATE INDEX `webhookDelivery_createdAt_idx` ON `WebhookDelivery` (`createdAt`);--> statement-breakpoint
CREATE INDEX `webhookDelivery_status_nextAttemptAt_idx` ON `WebhookDelivery` (`status`,`nextAttemptAt`);