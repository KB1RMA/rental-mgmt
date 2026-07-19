CREATE TABLE `renewal_assumptions` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`proposed_rent_cents` integer,
	`monthly_principal_cents` integer DEFAULT 0 NOT NULL,
	`monthly_expense_override_cents` integer,
	`notes` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `renewal_assumptions_property_id_unique` ON `renewal_assumptions` (`property_id`);