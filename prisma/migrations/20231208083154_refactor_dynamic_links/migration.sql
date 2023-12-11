/*
  Warnings:

  - You are about to drop the column `description` on the `DynamicLink` table. All the data in the column will be lost.
  - You are about to drop the column `fallbackUrl` on the `DynamicLink` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `DynamicLink` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `DynamicLink` table. All the data in the column will be lost.
  - Added the required column `name` to the `DynamicLink` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `DynamicLink` DROP COLUMN `description`,
    DROP COLUMN `fallbackUrl`,
    DROP COLUMN `imageUrl`,
    DROP COLUMN `title`,
    ADD COLUMN `name` VARCHAR(191) NOT NULL,
    MODIFY `playStoreUrl` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `appStoreUrl` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `iosTeamId` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `iosBundleId` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `androidPackageName` VARCHAR(191) NOT NULL DEFAULT '',
    MODIFY `androidSha256Fingerprint` VARCHAR(191) NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE `DynamicLinkChildLink` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dynamicLinkId` INTEGER NOT NULL,
    `metaDataTitle` VARCHAR(191) NOT NULL DEFAULT '',
    `metaDataDescription` VARCHAR(191) NOT NULL DEFAULT '',
    `metaDataImageUrl` VARCHAR(191) NOT NULL DEFAULT '',
    `link` VARCHAR(191) NOT NULL,

    INDEX `DynamicLinkChildLink_dynamicLinkId_idx`(`dynamicLinkId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
