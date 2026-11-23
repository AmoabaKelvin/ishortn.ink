CREATE TABLE `CheckoutStart` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`userId` varchar(32) NOT NULL,
	`plan` enum('pro','ultra') NOT NULL,
	`interval` enum('monthly','annual') NOT NULL,
	`source` varchar(64),
	`promoCode` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `CheckoutStart_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `checkoutStart_createdAt_idx` ON `CheckoutStart` (`createdAt`);--> statement-breakpoint
CREATE INDEX `checkoutStart_userId_idx` ON `CheckoutStart` (`userId`);