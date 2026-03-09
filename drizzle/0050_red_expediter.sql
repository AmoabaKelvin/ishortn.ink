CREATE INDEX `createdAt_idx` ON `Link` (`createdAt`);--> statement-breakpoint
CREATE INDEX `blocked_blockedAt_idx` ON `Link` (`blocked`,`blockedAt`);