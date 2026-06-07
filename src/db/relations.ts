import { relations } from "drizzle-orm/relations";
import { users, lands, crops, stages, cycles, statuses, phases, warehouses, items, categories, roles, movements, moveTypes, needs } from "./schema";

export const landsRelations = relations(lands, ({one, many}) => ({
	user: one(users, {
		fields: [lands.farmerId],
		references: [users.id]
	}),
	cycles: many(cycles),
	movements: many(movements),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	lands: many(lands),
	warehouses: many(warehouses),
	role: one(roles, {
		fields: [users.roleId],
		references: [roles.id]
	}),
}));

export const stagesRelations = relations(stages, ({one, many}) => ({
	crop: one(crops, {
		fields: [stages.cropId],
		references: [crops.id]
	}),
	phases: many(phases),
}));

export const cropsRelations = relations(crops, ({many}) => ({
	stages: many(stages),
	cycles: many(cycles),
}));

export const cyclesRelations = relations(cycles, ({one, many}) => ({
	land: one(lands, {
		fields: [cycles.landId],
		references: [lands.id]
	}),
	crop: one(crops, {
		fields: [cycles.cropId],
		references: [crops.id]
	}),
	status: one(statuses, {
		fields: [cycles.statusId],
		references: [statuses.id]
	}),
	phases: many(phases),
}));

export const statusesRelations = relations(statuses, ({many}) => ({
	cycles: many(cycles),
	phases: many(phases),
	movements: many(movements),
}));

export const phasesRelations = relations(phases, ({one, many}) => ({
	cycle: one(cycles, {
		fields: [phases.cycleId],
		references: [cycles.id]
	}),
	stage: one(stages, {
		fields: [phases.stageId],
		references: [stages.id]
	}),
	status: one(statuses, {
		fields: [phases.statusId],
		references: [statuses.id]
	}),
	needs: many(needs),
}));

export const warehousesRelations = relations(warehouses, ({one, many}) => ({
	user: one(users, {
		fields: [warehouses.farmerId],
		references: [users.id]
	}),
	items: many(items),
	movements_warehouseId: many(movements, {
		relationName: "movements_warehouseId_warehouses_id"
	}),
	movements_warehouseDest: many(movements, {
		relationName: "movements_warehouseDest_warehouses_id"
	}),
}));

export const itemsRelations = relations(items, ({one, many}) => ({
	warehouse: one(warehouses, {
		fields: [items.warehouseId],
		references: [warehouses.id]
	}),
	category: one(categories, {
		fields: [items.categoryId],
		references: [categories.id]
	}),
	movements: many(movements),
	needs: many(needs),
}));

export const categoriesRelations = relations(categories, ({many}) => ({
	items: many(items),
}));

export const rolesRelations = relations(roles, ({many}) => ({
	users: many(users),
}));

export const movementsRelations = relations(movements, ({one}) => ({
	warehouse_warehouseId: one(warehouses, {
		fields: [movements.warehouseId],
		references: [warehouses.id],
		relationName: "movements_warehouseId_warehouses_id"
	}),
	item: one(items, {
		fields: [movements.itemId],
		references: [items.id]
	}),
	moveType: one(moveTypes, {
		fields: [movements.movetypeId],
		references: [moveTypes.id]
	}),
	status: one(statuses, {
		fields: [movements.statusId],
		references: [statuses.id]
	}),
	land: one(lands, {
		fields: [movements.landDest],
		references: [lands.id]
	}),
	warehouse_warehouseDest: one(warehouses, {
		fields: [movements.warehouseDest],
		references: [warehouses.id],
		relationName: "movements_warehouseDest_warehouses_id"
	}),
}));

export const moveTypesRelations = relations(moveTypes, ({many}) => ({
	movements: many(movements),
}));

export const needsRelations = relations(needs, ({one}) => ({
	phase: one(phases, {
		fields: [needs.phaseId],
		references: [phases.id]
	}),
	item: one(items, {
		fields: [needs.itemId],
		references: [items.id]
	}),
}));