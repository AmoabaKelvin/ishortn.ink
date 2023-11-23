-- DropForeignKey
ALTER TABLE `Link` DROP FOREIGN KEY `Link_userId_fkey`;

-- DropForeignKey
ALTER TABLE `LinkVisit` DROP FOREIGN KEY `LinkVisit_linkId_fkey`;

-- AlterTable
ALTER TABLE `Link` ADD COLUMN `disableLinkAfterClicks` INTEGER NULL,
    ADD COLUMN `disableLinkAfterDate` DATETIME(3) NULL;

-- RenameIndex
ALTER TABLE `Link` RENAME INDEX `Link_userId_fkey` TO `Link_userId_idx`;

-- RenameIndex
ALTER TABLE `LinkVisit` RENAME INDEX `LinkVisit_linkId_fkey` TO `LinkVisit_linkId_idx`;
