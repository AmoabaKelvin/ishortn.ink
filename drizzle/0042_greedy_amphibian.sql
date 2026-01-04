ALTER TABLE `CustomDomain` ADD `teamIdForUnique` int GENERATED ALWAYS AS (COALESCE(`teamId`, 0)) STORED;--> statement-breakpoint
ALTER TABLE `CustomDomain` ADD CONSTRAINT `domain_workspace_unique` UNIQUE(`domain`,`userId`,`teamIdForUnique`);
