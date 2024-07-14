ALTER TABLE `Link` DROP INDEX `Link_alias_key`;--> statement-breakpoint
ALTER TABLE `Link` ADD `domain` varchar(255) DEFAULT 'ishortn.ink' NOT NULL;--> statement-breakpoint
CREATE INDEX `aliasDomain_idx` ON `Link` (`alias`,`domain`);