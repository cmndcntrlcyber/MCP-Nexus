import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const servers = pgTable("servers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  deviceId: text("device_id").notNull(),
  command: text("command").notNull(),
  args: jsonb("args").$type<string[]>().default([]),
  env: jsonb("env").$type<Record<string, string>>().default({}),
  status: text("status").notNull().default("stopped"), // running, stopped, error
  pid: integer("pid"),
  autoRestart: boolean("auto_restart").default(true),
  maxRestarts: integer("max_restarts").default(3),
  restartCount: integer("restart_count").default(0),
  uptime: timestamp("uptime"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const edgeDevices = pgTable("edge_devices", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("offline"), // online, offline, error
  lastSeen: timestamp("last_seen"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const serverLogs = pgTable("server_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serverId: text("server_id").notNull(),
  level: text("level").notNull(), // info, warn, error
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertServerSchema = createInsertSchema(servers).omit({
  id: true,
  pid: true,
  uptime: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEdgeDeviceSchema = createInsertSchema(edgeDevices).omit({
  createdAt: true,
});

export const insertServerLogSchema = createInsertSchema(serverLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertServer = z.infer<typeof insertServerSchema>;
export type Server = typeof servers.$inferSelect;
export type InsertEdgeDevice = z.infer<typeof insertEdgeDeviceSchema>;
export type EdgeDevice = typeof edgeDevices.$inferSelect;
export type InsertServerLog = z.infer<typeof insertServerLogSchema>;
export type ServerLog = typeof serverLogs.$inferSelect;
