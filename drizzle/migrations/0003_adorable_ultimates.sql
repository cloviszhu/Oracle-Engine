ALTER TABLE `notification_deliveries` ADD `card_version` int;--> statement-breakpoint
UPDATE `notification_deliveries` SET `card_version` = 1 WHERE `card_version` IS NULL;--> statement-breakpoint
ALTER TABLE `notification_deliveries` MODIFY COLUMN `card_version` int NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_deliveries` DROP INDEX `notification_deliveries_user_event_uidx`;--> statement-breakpoint
ALTER TABLE `notification_deliveries` ADD CONSTRAINT `notification_deliveries_user_event_uidx` UNIQUE(`channel`,`content_event_key`,`card_version`,`policy_version`);
