import {
  sqliteTable,
  integer,
  text,
  real,
  primaryKey,
  unique,
} from 'drizzle-orm/sqlite-core'

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .notNull()
    .default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', {
    mode: 'timestamp',
  }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', {
    mode: 'timestamp',
  }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())

const createdAt = () =>
  integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date())

export const properties = sqliteTable('properties', {
  id: id(),
  name: text('name').notNull(),
  addressLine1: text('address_line1').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  zip: text('zip').notNull(),
  assessorPid: text('assessor_pid'),
  purchaseDate: text('purchase_date'),
  purchasePriceCents: integer('purchase_price_cents'),
  notes: text('notes'),
  createdAt: createdAt(),
})

export const units = sqliteTable('units', {
  id: id(),
  propertyId: text('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  createdAt: createdAt(),
})

export const tenants = sqliteTable('tenants', {
  id: id(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  notes: text('notes'),
  createdAt: createdAt(),
})

export const leases = sqliteTable('leases', {
  id: id(),
  unitId: text('unit_id')
    .notNull()
    .references(() => units.id, { onDelete: 'cascade' }),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  rentCents: integer('rent_cents').notNull(),
  rentDueDay: integer('rent_due_day').notNull(),
  lateFeeCents: integer('late_fee_cents').notNull(),
  lateFeeGraceDays: integer('late_fee_grace_days').notNull(),
  securityDepositCents: integer('security_deposit_cents').notNull(),
  noticeDays: integer('notice_days').notNull(),
  status: text('status', { enum: ['active', 'ended', 'renewed'] })
    .notNull()
    .default('active'),
  createdAt: createdAt(),
})

export const leaseTenants = sqliteTable(
  'lease_tenants',
  {
    leaseId: text('lease_id')
      .notNull()
      .references(() => leases.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.leaseId, table.tenantId] })],
)

export const documents = sqliteTable('documents', {
  id: id(),
  kind: text('kind', {
    enum: ['lease', 'statement', 'receipt', 'assessor_raw', 'other'],
  }).notNull(),
  r2Key: text('r2_key').notNull().unique(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  propertyId: text('property_id').references(() => properties.id, {
    onDelete: 'set null',
  }),
  leaseId: text('lease_id').references(() => leases.id, {
    onDelete: 'set null',
  }),
  uploadedAt: createdAt(),
})

export const plaidItems = sqliteTable('plaid_items', {
  id: id(),
  plaidItemId: text('plaid_item_id').notNull().unique(),
  institutionName: text('institution_name').notNull(),
  accessTokenCiphertext: text('access_token_ciphertext').notNull(),
  accessTokenIv: text('access_token_iv').notNull(),
  syncCursor: text('sync_cursor'),
  status: text('status', { enum: ['active', 'error', 'disconnected'] })
    .notNull()
    .default('active'),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
  lastError: text('last_error'),
  createdAt: createdAt(),
})

export const plaidAccounts = sqliteTable('plaid_accounts', {
  id: id(),
  plaidItemId: text('plaid_item_id')
    .notNull()
    .references(() => plaidItems.id, { onDelete: 'cascade' }),
  plaidAccountId: text('plaid_account_id').notNull().unique(),
  name: text('name').notNull(),
  mask: text('mask'),
  type: text('type').notNull(),
  subtype: text('subtype'),
})

export const scheduleELines = [
  'advertising',
  'auto_travel',
  'cleaning_maintenance',
  'commissions',
  'insurance',
  'legal_professional',
  'management_fees',
  'mortgage_interest',
  'other_interest',
  'repairs',
  'supplies',
  'taxes',
  'utilities',
  'depreciation',
  'other',
] as const

export const categories = sqliteTable('categories', {
  id: id(),
  name: text('name').notNull(),
  type: text('type', {
    enum: ['income', 'expense', 'transfer', 'ignore'],
  }).notNull(),
  scheduleELine: text('schedule_e_line', { enum: scheduleELines }),
})

export const categorizationRules = sqliteTable('categorization_rules', {
  id: id(),
  priority: integer('priority').notNull(),
  field: text('field', { enum: ['description', 'merchant'] }).notNull(),
  matchType: text('match_type', {
    enum: ['contains', 'exact', 'regex'],
  }).notNull(),
  pattern: text('pattern').notNull(),
  amountMinCents: integer('amount_min_cents'),
  amountMaxCents: integer('amount_max_cents'),
  categoryId: text('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

export const transactions = sqliteTable('transactions', {
  id: id(),
  propertyId: text('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  plaidAccountId: text('plaid_account_id').references(() => plaidAccounts.id, {
    onDelete: 'set null',
  }),
  postedDate: text('posted_date').notNull(),
  amountCents: integer('amount_cents').notNull(),
  description: text('description').notNull(),
  merchant: text('merchant'),
  source: text('source', { enum: ['plaid', 'csv', 'manual'] }).notNull(),
  plaidTransactionId: text('plaid_transaction_id').unique(),
  pending: integer('pending', { mode: 'boolean' }).notNull().default(false),
  dedupeHash: text('dedupe_hash').notNull().unique(),
  categoryId: text('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  categorizedBy: text('categorized_by', { enum: ['rule', 'manual'] }),
  notes: text('notes'),
  createdAt: createdAt(),
})

export const rentCharges = sqliteTable(
  'rent_charges',
  {
    id: id(),
    leaseId: text('lease_id')
      .notNull()
      .references(() => leases.id, { onDelete: 'cascade' }),
    period: text('period').notNull(),
    dueDate: text('due_date').notNull(),
    amountCents: integer('amount_cents').notNull(),
    status: text('status', {
      enum: ['due', 'paid', 'partial', 'late', 'waived'],
    })
      .notNull()
      .default('due'),
  },
  (table) => [unique().on(table.leaseId, table.period)],
)

export const rentPayments = sqliteTable('rent_payments', {
  id: id(),
  rentChargeId: text('rent_charge_id')
    .notNull()
    .references(() => rentCharges.id, { onDelete: 'cascade' }),
  transactionId: text('transaction_id').references(() => transactions.id, {
    onDelete: 'set null',
  }),
  paidDate: text('paid_date').notNull(),
  amountCents: integer('amount_cents').notNull(),
  method: text('method'),
})

export const taxAssessments = sqliteTable(
  'tax_assessments',
  {
    id: id(),
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    fiscalYear: integer('fiscal_year').notNull(),
    assessedLandCents: integer('assessed_land_cents').notNull(),
    assessedBuildingCents: integer('assessed_building_cents').notNull(),
    assessedTotalCents: integer('assessed_total_cents').notNull(),
    taxRateMillsX100: integer('tax_rate_mills_x100').notNull(),
    annualTaxCents: integer('annual_tax_cents').notNull(),
    sourceUrl: text('source_url'),
    rawDocumentId: text('raw_document_id').references(() => documents.id, {
      onDelete: 'set null',
    }),
    scrapedAt: integer('scraped_at', { mode: 'timestamp' }),
  },
  (table) => [unique().on(table.propertyId, table.fiscalYear)],
)

export const comparableRents = sqliteTable('comparable_rents', {
  id: id(),
  propertyId: text('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  source: text('source'),
  address: text('address'),
  beds: integer('beds'),
  baths: real('baths'),
  sqft: integer('sqft'),
  monthlyRentCents: integer('monthly_rent_cents').notNull(),
  url: text('url'),
  notedAt: text('noted_at').notNull(),
})
