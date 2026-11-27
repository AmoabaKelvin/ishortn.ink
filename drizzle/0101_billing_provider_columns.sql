ALTER TABLE `CheckoutStart` ADD `provider` varchar(16) DEFAULT 'lemonsqueezy' NOT NULL;--> statement-breakpoint
ALTER TABLE `Subscription` ADD `billingProvider` varchar(16) DEFAULT 'lemonsqueezy' NOT NULL;--> statement-breakpoint
ALTER TABLE `Subscription` ADD `providerSubscriptionId` varchar(64);--> statement-breakpoint
ALTER TABLE `Subscription` ADD `providerCustomerId` varchar(64);--> statement-breakpoint
ALTER TABLE `Subscription` ADD `providerPriceId` varchar(64);--> statement-breakpoint
ALTER TABLE `SubscriptionCancellation` ADD `providerSubscriptionId` varchar(64);--> statement-breakpoint
CREATE INDEX `subscription_providerSubscriptionId_idx` ON `Subscription` (`providerSubscriptionId`);--> statement-breakpoint
CREATE INDEX `subscription_providerCustomerId_idx` ON `Subscription` (`providerCustomerId`);