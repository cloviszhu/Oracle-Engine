CREATE TABLE `budget_reservations` (
	`id` varchar(128) NOT NULL,
	`provider` varchar(32) NOT NULL,
	`budget_date` varchar(10) NOT NULL,
	`idempotency_key` varchar(255) NOT NULL,
	`reserved_cents` decimal(12,4) NOT NULL,
	`settled_cents` decimal(12,4),
	`status` enum('reserved','settled','released') NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `budget_reservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `budget_reservations_provider_key_uidx` UNIQUE(`provider`,`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `card_entities` (
	`id` varchar(128) NOT NULL,
	`card_id` varchar(128) NOT NULL,
	`type` enum('company','ticker','topic') NOT NULL,
	`normalized_value` varchar(255) NOT NULL,
	`display_value` varchar(255) NOT NULL,
	`verification_status` enum('verified_source','needs_verification','unverified') NOT NULL,
	CONSTRAINT `card_entities_id` PRIMARY KEY(`id`),
	CONSTRAINT `card_entities_card_type_value_uidx` UNIQUE(`card_id`,`type`,`normalized_value`)
);
--> statement-breakpoint
CREATE TABLE `content_items` (
	`id` varchar(128) NOT NULL,
	`provider` varchar(32) NOT NULL,
	`external_id` varchar(128) NOT NULL,
	`source_account_id` varchar(128),
	`author_external_id` varchar(128) NOT NULL,
	`source_url` varchar(2048) NOT NULL,
	`content_type` enum('post','reply','quote') NOT NULL,
	`visibility` enum('active','verification_pending','deleted','unavailable') NOT NULL,
	`current_version_id` varchar(128),
	`first_observed_at` datetime(3) NOT NULL,
	`last_observed_at` datetime(3) NOT NULL,
	`published_at` datetime(3) NOT NULL,
	CONSTRAINT `content_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_items_provider_external_uidx` UNIQUE(`provider`,`external_id`)
);
--> statement-breakpoint
CREATE TABLE `content_lifecycle_events` (
	`id` varchar(128) NOT NULL,
	`content_id` varchar(128) NOT NULL,
	`from_visibility` varchar(32),
	`to_visibility` varchar(32) NOT NULL,
	`evidence_category` varchar(64) NOT NULL,
	`provider_request_id` varchar(255),
	`reason` varchar(500),
	`occurred_at` datetime(3) NOT NULL,
	`confirmed_at` datetime(3),
	CONSTRAINT `content_lifecycle_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_relations` (
	`id` varchar(128) NOT NULL,
	`from_content_id` varchar(128) NOT NULL,
	`relation_type` enum('reply_to','quotes','edit_predecessor','conversation') NOT NULL,
	`to_content_id` varchar(128),
	`to_external_id` varchar(128) NOT NULL,
	`missing_reason` varchar(255),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `content_relations_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_relations_direction_uidx` UNIQUE(`from_content_id`,`relation_type`,`to_external_id`)
);
--> statement-breakpoint
CREATE TABLE `content_versions` (
	`id` varchar(128) NOT NULL,
	`content_id` varchar(128) NOT NULL,
	`version` int NOT NULL,
	`external_edit_id` varchar(128),
	`payload_hash` varchar(64) NOT NULL,
	`body` text,
	`raw_payload` json,
	`raw_payload_bytes` int NOT NULL DEFAULT 0,
	`provider_request_id` varchar(255),
	`published_at` datetime(3) NOT NULL,
	`fetched_at` datetime(3) NOT NULL,
	`cleared_at` datetime(3),
	CONSTRAINT `content_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_versions_content_hash_uidx` UNIQUE(`content_id`,`payload_hash`),
	CONSTRAINT `content_versions_content_version_uidx` UNIQUE(`content_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `external_usage` (
	`id` varchar(128) NOT NULL,
	`provider` varchar(32) NOT NULL,
	`operation` varchar(64) NOT NULL,
	`api_version` varchar(128),
	`model` varchar(128),
	`provider_request_id` varchar(255),
	`status` varchar(32) NOT NULL,
	`input_units` bigint unsigned NOT NULL DEFAULT 0,
	`output_units` bigint unsigned NOT NULL DEFAULT 0,
	`resource_units` bigint unsigned NOT NULL DEFAULT 0,
	`cost_cents` decimal(12,4) NOT NULL DEFAULT '0',
	`occurred_at` datetime(3) NOT NULL,
	CONSTRAINT `external_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `importance_scores` (
	`id` varchar(128) NOT NULL,
	`card_id` varchar(128) NOT NULL,
	`policy_version` varchar(64) NOT NULL,
	`features` json NOT NULL,
	`weights` json NOT NULL,
	`total_score` decimal(7,3) NOT NULL,
	`threshold` decimal(7,3) NOT NULL,
	`decision` enum('notify_candidate','suppress') NOT NULL,
	`reason` varchar(1000) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `importance_scores_id` PRIMARY KEY(`id`),
	CONSTRAINT `importance_scores_card_policy_uidx` UNIQUE(`card_id`,`policy_version`)
);
--> statement-breakpoint
CREATE TABLE `ingestion_runs` (
	`id` varchar(128) NOT NULL,
	`source_account_id` varchar(128) NOT NULL,
	`mode` enum('poll','compensation','verification') NOT NULL,
	`status` enum('pending','processing','succeeded','retryable_failed','blocked','dead_letter') NOT NULL,
	`correlation_id` varchar(128) NOT NULL,
	`pages` int NOT NULL DEFAULT 0,
	`items` int NOT NULL DEFAULT 0,
	`error_code` varchar(64),
	`started_at` datetime(3) NOT NULL,
	`finished_at` datetime(3),
	CONSTRAINT `ingestion_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_attempts` (
	`id` varchar(128) NOT NULL,
	`delivery_id` varchar(128) NOT NULL,
	`attempt` int NOT NULL,
	`status` enum('pending','sending','sent','retryable_failed','outcome_unknown','blocked','dead_letter','suppressed') NOT NULL,
	`provider_request_id` varchar(255),
	`error_code` varchar(64),
	`started_at` datetime(3) NOT NULL,
	`finished_at` datetime(3),
	CONSTRAINT `notification_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_attempts_delivery_attempt_uidx` UNIQUE(`delivery_id`,`attempt`)
);
--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
	`id` varchar(128) NOT NULL,
	`score_id` varchar(128) NOT NULL,
	`channel` varchar(32) NOT NULL,
	`content_event_key` varchar(255) NOT NULL,
	`dedupe_key` varchar(255) NOT NULL,
	`policy_version` varchar(64) NOT NULL,
	`status` enum('pending','sending','sent','retryable_failed','outcome_unknown','blocked','dead_letter','suppressed') NOT NULL,
	`provider_id` varchar(255),
	`error_code` varchar(64),
	`manual_retry_allowed` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL,
	`sent_at` datetime(3),
	CONSTRAINT `notification_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_deliveries_dedupe_uidx` UNIQUE(`channel`,`dedupe_key`),
	CONSTRAINT `notification_deliveries_user_event_uidx` UNIQUE(`channel`,`content_event_key`,`policy_version`)
);
--> statement-breakpoint
CREATE TABLE `processing_attempts` (
	`id` varchar(128) NOT NULL,
	`intent_id` varchar(128) NOT NULL,
	`attempt` int NOT NULL,
	`status` enum('pending','processing','succeeded','retryable_failed','blocked','dead_letter') NOT NULL,
	`lease_owner` varchar(128),
	`lease_expires_at` datetime(3),
	`fencing_token` bigint unsigned NOT NULL,
	`error_code` varchar(64),
	`error_category` varchar(64),
	`provider` varchar(32),
	`provider_version` varchar(128),
	`started_at` datetime(3) NOT NULL,
	`finished_at` datetime(3),
	CONSTRAINT `processing_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `processing_attempts_intent_attempt_uidx` UNIQUE(`intent_id`,`attempt`)
);
--> statement-breakpoint
CREATE TABLE `processing_intents` (
	`id` varchar(128) NOT NULL,
	`content_id` varchar(128),
	`content_version_id` varchar(128),
	`stage` enum('ingest','context','analysis','score') NOT NULL,
	`idempotency_key` varchar(255) NOT NULL,
	`status` enum('pending','processing','succeeded','retryable_failed','blocked','dead_letter') NOT NULL,
	`block_reason` varchar(64),
	`manual_retry_allowed` boolean NOT NULL DEFAULT false,
	`available_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `processing_intents_id` PRIMARY KEY(`id`),
	CONSTRAINT `processing_intents_stage_key_uidx` UNIQUE(`stage`,`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `research_cards` (
	`id` varchar(128) NOT NULL,
	`content_id` varchar(128) NOT NULL,
	`content_version_id` varchar(128) NOT NULL,
	`version` int NOT NULL,
	`analysis_key` varchar(255) NOT NULL,
	`translation` text NOT NULL,
	`author_judgment` json NOT NULL,
	`others_content` json NOT NULL,
	`ai_explanation` json NOT NULL,
	`unverified_inferences` json NOT NULL,
	`viewpoint_change` text,
	`evidence` json NOT NULL,
	`uncertainties` json NOT NULL,
	`confidence` enum('low','medium','high') NOT NULL,
	`confidence_score` decimal(5,4) NOT NULL,
	`prompt_version` varchar(64) NOT NULL,
	`provider` varchar(32) NOT NULL,
	`model` varchar(128) NOT NULL,
	`provider_request_id` varchar(255),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `research_cards_id` PRIMARY KEY(`id`),
	CONSTRAINT `research_cards_analysis_key_uidx` UNIQUE(`analysis_key`),
	CONSTRAINT `research_cards_content_version_uidx` UNIQUE(`content_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `source_accounts` (
	`id` varchar(128) NOT NULL,
	`provider` varchar(32) NOT NULL,
	`external_user_id` varchar(128) NOT NULL,
	`username` varchar(128) NOT NULL,
	`display_name` varchar(255),
	`enabled` boolean NOT NULL DEFAULT false,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `source_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `source_accounts_provider_external_uidx` UNIQUE(`provider`,`external_user_id`)
);
--> statement-breakpoint
CREATE TABLE `source_sync_states` (
	`source_account_id` varchar(128) NOT NULL,
	`since_id` varchar(128),
	`last_success_at` datetime(3),
	`last_attempt_at` datetime(3),
	`next_poll_at` datetime(3),
	`status` varchar(32) NOT NULL,
	`error_code` varchar(64),
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `source_sync_states_source_account_id` PRIMARY KEY(`source_account_id`)
);
--> statement-breakpoint
CREATE TABLE `user_feedback` (
	`id` varchar(128) NOT NULL,
	`card_id` varchar(128) NOT NULL,
	`card_version` int NOT NULL,
	`actor_id` varchar(64) NOT NULL,
	`type` enum('important','known','irrelevant','follow','translation_error','analysis_error') NOT NULL,
	`note` varchar(1000),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `user_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `worker_heartbeats` (
	`worker_id` varchar(128) NOT NULL,
	`started_at` datetime(3) NOT NULL,
	`heartbeat_at` datetime(3) NOT NULL,
	`status` enum('starting','ready','stopping') NOT NULL,
	`version` varchar(64) NOT NULL,
	CONSTRAINT `worker_heartbeats_worker_id` PRIMARY KEY(`worker_id`)
);
--> statement-breakpoint
ALTER TABLE `card_entities` ADD CONSTRAINT `card_entities_card_id_research_cards_id_fk` FOREIGN KEY (`card_id`) REFERENCES `research_cards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_items` ADD CONSTRAINT `content_items_source_account_id_source_accounts_id_fk` FOREIGN KEY (`source_account_id`) REFERENCES `source_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_lifecycle_events` ADD CONSTRAINT `content_lifecycle_events_content_id_content_items_id_fk` FOREIGN KEY (`content_id`) REFERENCES `content_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_relations` ADD CONSTRAINT `content_relations_from_content_id_content_items_id_fk` FOREIGN KEY (`from_content_id`) REFERENCES `content_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_relations` ADD CONSTRAINT `content_relations_to_content_id_content_items_id_fk` FOREIGN KEY (`to_content_id`) REFERENCES `content_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_versions` ADD CONSTRAINT `content_versions_content_id_content_items_id_fk` FOREIGN KEY (`content_id`) REFERENCES `content_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `importance_scores` ADD CONSTRAINT `importance_scores_card_id_research_cards_id_fk` FOREIGN KEY (`card_id`) REFERENCES `research_cards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ingestion_runs` ADD CONSTRAINT `ingestion_runs_source_account_id_source_accounts_id_fk` FOREIGN KEY (`source_account_id`) REFERENCES `source_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_attempts` ADD CONSTRAINT `notification_attempts_delivery_id_notification_deliveries_id_fk` FOREIGN KEY (`delivery_id`) REFERENCES `notification_deliveries`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_deliveries` ADD CONSTRAINT `notification_deliveries_score_id_importance_scores_id_fk` FOREIGN KEY (`score_id`) REFERENCES `importance_scores`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `processing_attempts` ADD CONSTRAINT `processing_attempts_intent_id_processing_intents_id_fk` FOREIGN KEY (`intent_id`) REFERENCES `processing_intents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `processing_intents` ADD CONSTRAINT `processing_intents_content_id_content_items_id_fk` FOREIGN KEY (`content_id`) REFERENCES `content_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `processing_intents` ADD CONSTRAINT `processing_intents_content_version_id_content_versions_id_fk` FOREIGN KEY (`content_version_id`) REFERENCES `content_versions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `research_cards` ADD CONSTRAINT `research_cards_content_id_content_items_id_fk` FOREIGN KEY (`content_id`) REFERENCES `content_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `research_cards` ADD CONSTRAINT `research_cards_content_version_id_content_versions_id_fk` FOREIGN KEY (`content_version_id`) REFERENCES `content_versions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `source_sync_states` ADD CONSTRAINT `source_sync_states_source_account_id_source_accounts_id_fk` FOREIGN KEY (`source_account_id`) REFERENCES `source_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_feedback` ADD CONSTRAINT `user_feedback_card_id_research_cards_id_fk` FOREIGN KEY (`card_id`) REFERENCES `research_cards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `budget_reservations_daily_idx` ON `budget_reservations` (`provider`,`budget_date`,`status`);--> statement-breakpoint
CREATE INDEX `content_items_published_idx` ON `content_items` (`published_at`,`id`);--> statement-breakpoint
CREATE INDEX `content_lifecycle_content_time_idx` ON `content_lifecycle_events` (`content_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `external_usage_provider_time_idx` ON `external_usage` (`provider`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `ingestion_runs_source_started_idx` ON `ingestion_runs` (`source_account_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `processing_intents_dispatch_idx` ON `processing_intents` (`status`,`available_at`);--> statement-breakpoint
CREATE INDEX `user_feedback_card_actor_idx` ON `user_feedback` (`card_id`,`actor_id`,`created_at`);