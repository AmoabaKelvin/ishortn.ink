-- Hand-written: brings production in line with schema.ts. The original tables predate drizzle
-- (0000 used CREATE TABLE IF NOT EXISTS), so generated migrations never covered this drift.
-- Definitions production already has (int ids, datetime(3) createdAt, Link.alias varchar(255),
-- LinkVisit varchar(191) columns, User_email_key, idx_lower_alias_domain, UniqueLinkVisit
-- createdAt_idx) are adopted by schema.ts and the snapshot only.
ALTER TABLE `User` MODIFY `name` varchar(255) NOT NULL DEFAULT '', MODIFY `email` varchar(255) NOT NULL, MODIFY `imageUrl` text;--> statement-breakpoint
ALTER TABLE `Link` MODIFY `userId` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `Token` MODIFY `userId` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `Subscription` MODIFY `userId` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `ReservedAlias` MODIFY `alias` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `LinkPreviousAddress` MODIFY `alias` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `BioBlock` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `BioPageView` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `BlockedDomain` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `Campaign` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `FlaggedLink` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `Folder` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `GeoRule` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `LinkMilestone` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `QrCode` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `QrPreset` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `Subscription` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `Tag` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `UniqueBioPageView` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `UtmTemplate` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
-- Created by 0091/0093/0094/0096 after the drift audit; small, so pin them to the same collation too.
ALTER TABLE `LinkPreviousAddress` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `CheckoutStart` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `WeeklySummaryEmail` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `SubscriptionCancellation` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
-- Table default only: no string column differs, and this avoids rebuilding UniqueLinkVisit.
ALTER TABLE `LinkTag` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `LinkVisitDailySummary` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `BioPageViewDailySummary` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
ALTER TABLE `UniqueLinkVisit` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;--> statement-breakpoint
-- Production-only duplicates of indexes schema.ts defines (userId_idx, linkId_idx, PRIMARY).
ALTER TABLE `Link` DROP INDEX `Link_userId_idx`;--> statement-breakpoint
ALTER TABLE `LinkVisit` DROP INDEX `LinkVisit_linkId_idx`;--> statement-breakpoint
ALTER TABLE `Token` DROP INDEX `Token_userId_idx`;--> statement-breakpoint
ALTER TABLE `User` DROP INDEX `User_id_key`;
