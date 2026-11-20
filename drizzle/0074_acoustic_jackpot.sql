ALTER TABLE `Team` ADD `ownerPlanGraceEndsAt` timestamp;--> statement-breakpoint
ALTER TABLE `Team` ADD `ownerPlanGraceEmailStage` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `User` ADD `planGracePlan` enum('free','pro','ultra');--> statement-breakpoint
ALTER TABLE `User` ADD `planGraceEndsAt` timestamp;--> statement-breakpoint
ALTER TABLE `User` ADD `planGraceReason` enum('lapsed','over_plan');--> statement-breakpoint
ALTER TABLE `User` ADD `planGraceEmailStage` int DEFAULT 0;--> statement-breakpoint
CREATE INDEX `planGraceEndsAt_idx` ON `User` (`planGraceEndsAt`);