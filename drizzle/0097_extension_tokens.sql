ALTER TABLE `Token` ADD `kind` varchar(16) DEFAULT 'api' NOT NULL;--> statement-breakpoint
ALTER TABLE `Token` ADD `label` varchar(64);