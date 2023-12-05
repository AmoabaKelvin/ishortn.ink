-- AlterTable
ALTER TABLE `Link` ADD COLUMN `disabled` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `DynamicLink` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subdomain` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `playStoreUrl` VARCHAR(191) NOT NULL,
    `appStoreUrl` VARCHAR(191) NOT NULL,
    `iosTeamId` VARCHAR(191) NOT NULL,
    `iosBundleId` VARCHAR(191) NOT NULL,
    `androidPackageName` VARCHAR(191) NOT NULL,
    `androidSha256Fingerprint` VARCHAR(191) NOT NULL,
    `fallbackUrl` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `DynamicLink_subdomain_key`(`subdomain`),
    INDEX `DynamicLink_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
