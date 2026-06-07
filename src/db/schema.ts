import { pgTable, serial, varchar, integer, unique, bigserial, timestamp, index, bigint, text, smallint, foreignKey, numeric, json, date, uuid } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const migrations = pgTable("migrations", {
	id: serial().primaryKey().notNull(),
	migration: varchar({ length: 255 }).notNull(),
	batch: integer().notNull(),
});

export const roles = pgTable("roles", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => [
	unique("roles_name_unique").on(table.name),
]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
	email: varchar({ length: 255 }).primaryKey().notNull(),
	token: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
});

export const sessions = pgTable("sessions", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }),
	ipAddress: varchar("ip_address", { length: 45 }),
	userAgent: text("user_agent"),
	payload: text().notNull(),
	lastActivity: integer("last_activity").notNull(),
}, (table) => [
	index().using("btree", table.lastActivity.asc().nullsLast().op("int4_ops")),
	index().using("btree", table.userId.asc().nullsLast().op("int8_ops")),
]);

export const cache = pgTable("cache", {
	key: varchar({ length: 255 }).primaryKey().notNull(),
	value: text().notNull(),
	expiration: integer().notNull(),
});

export const cacheLocks = pgTable("cache_locks", {
	key: varchar({ length: 255 }).primaryKey().notNull(),
	owner: varchar({ length: 255 }).notNull(),
	expiration: integer().notNull(),
});

export const jobs = pgTable("jobs", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	queue: varchar({ length: 255 }).notNull(),
	payload: text().notNull(),
	attempts: smallint().notNull(),
	reservedAt: integer("reserved_at"),
	availableAt: integer("available_at").notNull(),
	createdAt: integer("created_at").notNull(),
}, (table) => [
	index().using("btree", table.queue.asc().nullsLast().op("text_ops")),
]);

export const jobBatches = pgTable("job_batches", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	totalJobs: integer("total_jobs").notNull(),
	pendingJobs: integer("pending_jobs").notNull(),
	failedJobs: integer("failed_jobs").notNull(),
	failedJobIds: text("failed_job_ids").notNull(),
	options: text(),
	cancelledAt: integer("cancelled_at"),
	createdAt: integer("created_at").notNull(),
	finishedAt: integer("finished_at"),
});

export const failedJobs = pgTable("failed_jobs", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	uuid: varchar({ length: 255 }).notNull(),
	connection: text().notNull(),
	queue: text().notNull(),
	payload: text().notNull(),
	exception: text().notNull(),
	failedAt: timestamp("failed_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	unique("failed_jobs_uuid_unique").on(table.uuid),
]);

export const personalAccessTokens = pgTable("personal_access_tokens", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	tokenableType: varchar("tokenable_type", { length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tokenableId: bigint("tokenable_id", { mode: "number" }).notNull(),
	name: text().notNull(),
	token: varchar({ length: 64 }).notNull(),
	abilities: text(),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => [
	index().using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	index().using("btree", table.tokenableType.asc().nullsLast().op("text_ops"), table.tokenableId.asc().nullsLast().op("text_ops")),
	unique("personal_access_tokens_token_unique").on(table.token),
]);

export const lands = pgTable("lands", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	farmerId: bigint("farmer_id", { mode: "number" }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	imageUrl: text("image_url"),
	description: text(),
	latitude: numeric({ precision: 10, scale:  7 }),
	longitude: numeric({ precision: 10, scale:  7 }),
	area: numeric({ precision: 8, scale:  2 }),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	boundary: json(),
}, (table) => [
	foreignKey({
			columns: [table.farmerId],
			foreignColumns: [users.id],
			name: "lands_farmer_id_foreign"
		}).onDelete("cascade"),
]);

export const stages = pgTable("stages", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cropId: bigint("crop_id", { mode: "number" }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	order: integer().default(1).notNull(),
	durationDays: integer("duration_days"),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.cropId],
			foreignColumns: [crops.id],
			name: "stages_crop_id_foreign"
		}).onDelete("cascade"),
]);

export const cycles = pgTable("cycles", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	landId: bigint("land_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cropId: bigint("crop_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	statusId: bigint("status_id", { mode: "number" }),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	startDate: date("start_date"),
	endDate: date("end_date"),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.landId],
			foreignColumns: [lands.id],
			name: "cycles_land_id_foreign"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.cropId],
			foreignColumns: [crops.id],
			name: "cycles_crop_id_foreign"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.statusId],
			foreignColumns: [statuses.id],
			name: "cycles_status_id_foreign"
		}).onDelete("set null"),
]);

export const statuses = pgTable("statuses", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	type: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
});

export const phases = pgTable("phases", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cycleId: bigint("cycle_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	stageId: bigint("stage_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	statusId: bigint("status_id", { mode: "number" }),
	startedAt: date("started_at"),
	endedAt: date("ended_at"),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.cycleId],
			foreignColumns: [cycles.id],
			name: "phases_cycle_id_foreign"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.stageId],
			foreignColumns: [stages.id],
			name: "phases_stage_id_foreign"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.statusId],
			foreignColumns: [statuses.id],
			name: "phases_status_id_foreign"
		}).onDelete("set null"),
]);

export const crops = pgTable("crops", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	imageUrl: text("image_url"),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	category: varchar({ length: 255 }),
});

export const warehouses = pgTable("warehouses", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	farmerId: bigint("farmer_id", { mode: "number" }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	imageUrl: varchar("image_url", { length: 255 }),
	description: varchar({ length: 255 }),
	location: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	capacity: integer(),
	latitude: numeric({ precision: 10, scale:  7 }),
	longitude: numeric({ precision: 10, scale:  7 }),
}, (table) => [
	foreignKey({
			columns: [table.farmerId],
			foreignColumns: [users.id],
			name: "warehouses_farmer_id_foreign"
		}).onDelete("cascade"),
]);

export const items = pgTable("items", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	warehouseId: bigint("warehouse_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	categoryId: bigint("category_id", { mode: "number" }),
	name: varchar({ length: 255 }).notNull(),
	unit: varchar({ length: 255 }).notNull(),
	stock: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.warehouseId],
			foreignColumns: [warehouses.id],
			name: "items_warehouse_id_foreign"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "items_category_id_foreign"
		}).onDelete("set null"),
]);

export const categories = pgTable("categories", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
});

export const users = pgTable("users", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	roleId: bigint("role_id", { mode: "number" }).notNull(),
	profilUrl: varchar("profil_url", { length: 255 }),
	phoneNumber: varchar("phone_number", { length: 255 }),
	email: varchar({ length: 255 }).notNull(),
	emailVerifiedAt: timestamp("email_verified_at", { mode: 'string' }),
	password: varchar({ length: 255 }),
	rememberToken: varchar("remember_token", { length: 100 }),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	weatherMode: varchar("weather_mode", { length: 255 }),
	weatherDistrict: varchar("weather_district", { length: 255 }),
	weatherLat: numeric("weather_lat", { precision: 10, scale:  7 }),
	weatherLon: numeric("weather_lon", { precision: 10, scale:  7 }),
	settings: json(),
	googleId: varchar("google_id", { length: 255 }),
	provider: varchar({ length: 255 }),
}, (table) => [
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "users_role_id_foreign"
		}).onDelete("cascade"),
	unique("users_phone_number_unique").on(table.phoneNumber),
	unique("users_email_unique").on(table.email),
	unique("users_google_id_unique").on(table.googleId),
]);

export const movements = pgTable("movements", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	warehouseId: bigint("warehouse_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	itemId: bigint("item_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	movetypeId: bigint("movetype_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	statusId: bigint("status_id", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	landDest: bigint("land_dest", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	warehouseDest: bigint("warehouse_dest", { mode: "number" }),
	quantity: numeric({ precision: 12, scale:  4 }).notNull(),
	note: text(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.warehouseId],
			foreignColumns: [warehouses.id],
			name: "movements_warehouse_id_foreign"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [items.id],
			name: "movements_item_id_foreign"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.movetypeId],
			foreignColumns: [moveTypes.id],
			name: "movements_movetype_id_foreign"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.statusId],
			foreignColumns: [statuses.id],
			name: "movements_status_id_foreign"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.landDest],
			foreignColumns: [lands.id],
			name: "movements_land_dest_foreign"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.warehouseDest],
			foreignColumns: [warehouses.id],
			name: "movements_warehouse_dest_foreign"
		}).onDelete("set null"),
]);

export const moveTypes = pgTable("move_types", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	code: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => [
	unique("move_types_code_unique").on(table.code),
]);

export const needs = pgTable("needs", {
	id: bigserial({ mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	phaseId: bigint("phase_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	itemId: bigint("item_id", { mode: "number" }).notNull(),
	quantityNeeded: integer("quantity_needed").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.phaseId],
			foreignColumns: [phases.id],
			name: "needs_phase_id_foreign"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [items.id],
			name: "needs_item_id_foreign"
		}).onDelete("cascade"),
]);

export const notifications = pgTable("notifications", {
	id: uuid().primaryKey().notNull(),
	type: varchar({ length: 255 }).notNull(),
	notifiableType: varchar("notifiable_type", { length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	notifiableId: bigint("notifiable_id", { mode: "number" }).notNull(),
	data: text().notNull(),
	readAt: timestamp("read_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => [
	index().using("btree", table.notifiableType.asc().nullsLast().op("int8_ops"), table.notifiableId.asc().nullsLast().op("int8_ops")),
]);
