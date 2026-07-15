CREATE TABLE `notification_recovery_requests` (
	`id` varchar(128) NOT NULL,
	`delivery_id` varchar(128) NOT NULL,
	`actor_id` varchar(64) NOT NULL,
	`previous_status` enum('blocked','dead_letter') NOT NULL,
	`requested_at` datetime(3) NOT NULL,
	CONSTRAINT `notification_recovery_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `notification_recovery_requests` ADD CONSTRAINT `notification_recovery_requests_delivery_id_notification_deliveries_id_fk` FOREIGN KEY (`delivery_id`) REFERENCES `notification_deliveries`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `notification_recovery_delivery_time_idx` ON `notification_recovery_requests` (`delivery_id`,`requested_at`);