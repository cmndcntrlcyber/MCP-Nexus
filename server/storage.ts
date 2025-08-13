import { type Server, type InsertServer, type EdgeDevice, type InsertEdgeDevice, type ServerLog, type InsertServerLog } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Server operations
  getServer(id: string): Promise<Server | undefined>;
  getAllServers(): Promise<Server[]>;
  getServersByDevice(deviceId: string): Promise<Server[]>;
  createServer(server: InsertServer): Promise<Server>;
  updateServer(id: string, updates: Partial<Server>): Promise<Server | undefined>;
  deleteServer(id: string): Promise<boolean>;

  // Edge device operations
  getEdgeDevice(id: string): Promise<EdgeDevice | undefined>;
  getAllEdgeDevices(): Promise<EdgeDevice[]>;
  createEdgeDevice(device: InsertEdgeDevice): Promise<EdgeDevice>;
  updateEdgeDevice(id: string, updates: Partial<EdgeDevice>): Promise<EdgeDevice | undefined>;
  deleteEdgeDevice(id: string): Promise<boolean>;

  // Server log operations
  getServerLogs(serverId: string, limit?: number): Promise<ServerLog[]>;
  addServerLog(log: InsertServerLog): Promise<ServerLog>;
  clearServerLogs(serverId: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private servers: Map<string, Server>;
  private edgeDevices: Map<string, EdgeDevice>;
  private serverLogs: Map<string, ServerLog[]>;

  constructor() {
    this.servers = new Map();
    this.edgeDevices = new Map();
    this.serverLogs = new Map();

    // Initialize with some edge devices for demo
    this.initializeDevices();
  }

  private initializeDevices() {
    const devices = [
      { id: "edge-device-001", name: "Production Server 1", status: "online" as const, lastSeen: new Date(), metadata: {} },
      { id: "edge-device-002", name: "Development Server", status: "offline" as const, lastSeen: new Date(Date.now() - 300000), metadata: {} },
      { id: "edge-device-003", name: "Staging Server", status: "online" as const, lastSeen: new Date(Date.now() - 60000), metadata: {} },
    ];

    devices.forEach(device => {
      const fullDevice: EdgeDevice = {
        ...device,
        createdAt: new Date(),
      };
      this.edgeDevices.set(device.id, fullDevice);
    });
  }

  // Server operations
  async getServer(id: string): Promise<Server | undefined> {
    return this.servers.get(id);
  }

  async getAllServers(): Promise<Server[]> {
    return Array.from(this.servers.values());
  }

  async getServersByDevice(deviceId: string): Promise<Server[]> {
    return Array.from(this.servers.values()).filter(server => server.deviceId === deviceId);
  }

  async createServer(insertServer: InsertServer): Promise<Server> {
    const id = randomUUID();
    const server: Server = {
      ...insertServer,
      id,
      pid: null,
      uptime: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.servers.set(id, server);
    return server;
  }

  async updateServer(id: string, updates: Partial<Server>): Promise<Server | undefined> {
    const server = this.servers.get(id);
    if (!server) return undefined;

    const updatedServer: Server = {
      ...server,
      ...updates,
      updatedAt: new Date(),
    };
    this.servers.set(id, updatedServer);
    return updatedServer;
  }

  async deleteServer(id: string): Promise<boolean> {
    const deleted = this.servers.delete(id);
    if (deleted) {
      this.serverLogs.delete(id);
    }
    return deleted;
  }

  // Edge device operations
  async getEdgeDevice(id: string): Promise<EdgeDevice | undefined> {
    return this.edgeDevices.get(id);
  }

  async getAllEdgeDevices(): Promise<EdgeDevice[]> {
    return Array.from(this.edgeDevices.values());
  }

  async createEdgeDevice(insertDevice: InsertEdgeDevice): Promise<EdgeDevice> {
    const device: EdgeDevice = {
      ...insertDevice,
      createdAt: new Date(),
    };
    this.edgeDevices.set(insertDevice.id, device);
    return device;
  }

  async updateEdgeDevice(id: string, updates: Partial<EdgeDevice>): Promise<EdgeDevice | undefined> {
    const device = this.edgeDevices.get(id);
    if (!device) return undefined;

    const updatedDevice: EdgeDevice = {
      ...device,
      ...updates,
    };
    this.edgeDevices.set(id, updatedDevice);
    return updatedDevice;
  }

  async deleteEdgeDevice(id: string): Promise<boolean> {
    return this.edgeDevices.delete(id);
  }

  // Server log operations
  async getServerLogs(serverId: string, limit: number = 100): Promise<ServerLog[]> {
    const logs = this.serverLogs.get(serverId) || [];
    return logs.slice(-limit);
  }

  async addServerLog(insertLog: InsertServerLog): Promise<ServerLog> {
    const log: ServerLog = {
      ...insertLog,
      id: randomUUID(),
      timestamp: new Date(),
    };

    if (!this.serverLogs.has(insertLog.serverId)) {
      this.serverLogs.set(insertLog.serverId, []);
    }

    const logs = this.serverLogs.get(insertLog.serverId)!;
    logs.push(log);

    // Keep only last 1000 logs per server
    if (logs.length > 1000) {
      logs.splice(0, logs.length - 1000);
    }

    return log;
  }

  async clearServerLogs(serverId: string): Promise<boolean> {
    this.serverLogs.delete(serverId);
    return true;
  }
}

export const storage = new MemStorage();
