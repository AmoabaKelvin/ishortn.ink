-- Allow the same domain to be used in both personal and team workspaces
-- The link table's unique constraint on (alias, domain) prevents conflicts

-- Step 1: Drop the global unique constraint on domain
ALTER TABLE `CustomDomain` DROP INDEX `CustomDomain_domain_unique`;

-- Step 2: Add a workspace-specific unique constraint
-- This prevents the same workspace from adding the same domain twice
-- For personal workspaces: unique on (domain, userId) where teamId is NULL
-- For team workspaces: unique on (domain, teamId)
ALTER TABLE `CustomDomain` ADD UNIQUE INDEX `domain_workspace_unique` (`domain`, `userId`, `teamId`);
