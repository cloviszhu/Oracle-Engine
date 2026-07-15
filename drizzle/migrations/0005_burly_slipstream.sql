ALTER TABLE `external_usage` ADD `protocol` varchar(32);--> statement-breakpoint
ALTER TABLE `external_usage` ADD `provider_host` varchar(255);--> statement-breakpoint
ALTER TABLE `external_usage` ADD `pricing_version` varchar(64);--> statement-breakpoint
ALTER TABLE `external_usage` ADD `prompt_version` varchar(64);--> statement-breakpoint
ALTER TABLE `external_usage` ADD `schema_version` varchar(64);--> statement-breakpoint
ALTER TABLE `external_usage` ADD `probe_version` varchar(32);