-- CreateTable
CREATE TABLE `UserLink` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `alias` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `UserLink_alias_key`(`alias`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LinkVisit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `linkId` INTEGER NOT NULL,
    `device` VARCHAR(191) NOT NULL,
    `browser` VARCHAR(191) NOT NULL,
    `os` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserLink` ADD CONSTRAINT `UserLink_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LinkVisit` ADD CONSTRAINT `LinkVisit_linkId_fkey` FOREIGN KEY (`linkId`) REFERENCES `UserLink`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
