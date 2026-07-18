CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`schedule_e_line` text
);
--> statement-breakpoint
CREATE TABLE `categorization_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`priority` integer NOT NULL,
	`field` text NOT NULL,
	`match_type` text NOT NULL,
	`pattern` text NOT NULL,
	`amount_min_cents` integer,
	`amount_max_cents` integer,
	`category_id` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `comparable_rents` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`source` text,
	`address` text,
	`beds` integer,
	`baths` real,
	`sqft` integer,
	`monthly_rent_cents` integer NOT NULL,
	`url` text,
	`noted_at` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`r2_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`property_id` text,
	`lease_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`lease_id`) REFERENCES `leases`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_r2_key_unique` ON `documents` (`r2_key`);--> statement-breakpoint
CREATE TABLE `lease_tenants` (
	`lease_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	PRIMARY KEY(`lease_id`, `tenant_id`),
	FOREIGN KEY (`lease_id`) REFERENCES `leases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `leases` (
	`id` text PRIMARY KEY NOT NULL,
	`unit_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`rent_cents` integer NOT NULL,
	`rent_due_day` integer NOT NULL,
	`late_fee_cents` integer NOT NULL,
	`late_fee_grace_days` integer NOT NULL,
	`security_deposit_cents` integer NOT NULL,
	`notice_days` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `plaid_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`plaid_item_id` text NOT NULL,
	`plaid_account_id` text NOT NULL,
	`name` text NOT NULL,
	`mask` text,
	`type` text NOT NULL,
	`subtype` text,
	FOREIGN KEY (`plaid_item_id`) REFERENCES `plaid_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plaid_accounts_plaid_account_id_unique` ON `plaid_accounts` (`plaid_account_id`);--> statement-breakpoint
CREATE TABLE `plaid_items` (
	`id` text PRIMARY KEY NOT NULL,
	`plaid_item_id` text NOT NULL,
	`institution_name` text NOT NULL,
	`access_token_ciphertext` text NOT NULL,
	`access_token_iv` text NOT NULL,
	`sync_cursor` text,
	`status` text DEFAULT 'active' NOT NULL,
	`last_synced_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plaid_items_plaid_item_id_unique` ON `plaid_items` (`plaid_item_id`);--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address_line1` text NOT NULL,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`zip` text NOT NULL,
	`assessor_pid` text,
	`purchase_date` text,
	`purchase_price_cents` integer,
	`notes` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rent_charges` (
	`id` text PRIMARY KEY NOT NULL,
	`lease_id` text NOT NULL,
	`period` text NOT NULL,
	`due_date` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text DEFAULT 'due' NOT NULL,
	FOREIGN KEY (`lease_id`) REFERENCES `leases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rent_charges_lease_id_period_unique` ON `rent_charges` (`lease_id`,`period`);--> statement-breakpoint
CREATE TABLE `rent_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`rent_charge_id` text NOT NULL,
	`transaction_id` text,
	`paid_date` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`method` text,
	FOREIGN KEY (`rent_charge_id`) REFERENCES `rent_charges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `tax_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`fiscal_year` integer NOT NULL,
	`assessed_land_cents` integer NOT NULL,
	`assessed_building_cents` integer NOT NULL,
	`assessed_total_cents` integer NOT NULL,
	`tax_rate_mills_x100` integer NOT NULL,
	`annual_tax_cents` integer NOT NULL,
	`source_url` text,
	`raw_document_id` text,
	`scraped_at` integer,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`raw_document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_assessments_property_id_fiscal_year_unique` ON `tax_assessments` (`property_id`,`fiscal_year`);--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`notes` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`plaid_account_id` text,
	`posted_date` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`description` text NOT NULL,
	`merchant` text,
	`source` text NOT NULL,
	`plaid_transaction_id` text,
	`pending` integer DEFAULT false NOT NULL,
	`dedupe_hash` text NOT NULL,
	`category_id` text,
	`categorized_by` text,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plaid_account_id`) REFERENCES `plaid_accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_plaid_transaction_id_unique` ON `transactions` (`plaid_transaction_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_dedupe_hash_unique` ON `transactions` (`dedupe_hash`);--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`label` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
