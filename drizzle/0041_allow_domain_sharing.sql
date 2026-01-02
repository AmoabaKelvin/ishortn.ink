-- Allow the same domain to be used in both personal and team workspaces
-- The link table's unique constraint on (alias, domain) prevents conflicts

-- Step 1: Drop the global unique constraint on domain
ALTER TABLE `CustomDomain` DROP INDEX `CustomDomain_domain_unique`;

-- Step 2: Add a generated column that treats NULL teamId as 0 for uniqueness purposes
-- This ensures personal workspaces (teamId = NULL) are treated as a single value
ALTER TABLE `CustomDomain` ADD COLUMN `teamIdForUnique` INT GENERATED ALWAYS AS (COALESCE(`teamId`, 0)) STORED;

-- Step 3: Add a workspace-specific unique constraint using the generated column
-- For personal workspaces: unique on (domain, userId, 0)
-- For team workspaces: unique on (domain, userId, teamId)
-- This prevents:
--   - Same domain twice in the same personal workspace
--   - Same domain twice in the same team
-- But allows:
--   - Same domain in personal workspace AND in a team
--   - Same domain across different teams
ALTER TABLE `CustomDomain` ADD UNIQUE INDEX `domain_workspace_unique` (`domain`, `userId`, `teamIdForUnique`);
