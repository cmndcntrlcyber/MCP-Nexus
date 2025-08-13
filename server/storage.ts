import { type Server, type InsertServer, type EdgeDevice, type InsertEdgeDevice, type ServerLog, type InsertServerLog } from "@shared/schema";
import { randomUUID } from "crypto";
import { MCPServerManager } from './mcp/MCPServerManager';

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

  // Monitoring operations
  getSystemMetrics(limit?: number): Promise<any[]>;
  addSystemMetrics(metrics: any): Promise<any>;
  getServerMetrics(serverId: string, limit?: number): Promise<any[]>;
  addServerMetrics(metrics: any): Promise<any>;
  getAlerts(active?: boolean): Promise<any[]>;
  addAlert(alert: any): Promise<any>;
  resolveAlert(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private servers: Map<string, Server>;
  private edgeDevices: Map<string, EdgeDevice>;
  private serverLogs: Map<string, ServerLog[]>;
  private mcpManager: MCPServerManager;

  constructor() {
    this.servers = new Map();
    this.edgeDevices = new Map();
    this.serverLogs = new Map();
    this.mcpManager = new MCPServerManager();
    
    // Setup MCP manager event handlers
    this.setupMCPEventHandlers();

    // Initialize with some edge devices for demo
    this.initializeDevices();
  }

  private setupMCPEventHandlers() {
    this.mcpManager.on('server:started', (status: Server) => {
      this.servers.set(status.id, status);
    });

    this.mcpManager.on('server:stopped', (status: Server) => {
      this.servers.set(status.id, status);
    });

    this.mcpManager.on('server:error', (data: any) => {
      console.error('MCP Server error:', data);
    });

    this.mcpManager.on('server:log', (data: any) => {
      this.addServerLog({
        serverId: data.id,
        level: data.level || 'info',
        message: data.log,
      });
    });
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

    // Add some demo servers
    const demoServers = [
      {
        name: "Filesystem MCP Server",
        deviceId: "edge-device-001",
        command: "npx",
        args: ["@modelcontextprotocol/server-filesystem", "/data"],
        env: {},
        status: "running" as const,
        autoRestart: true,
        maxRestarts: 3,
        restartCount: 0
      },
      {
        name: "GitHub MCP Server",
        deviceId: "edge-device-001",
        command: "npx",
        args: ["@modelcontextprotocol/server-github"],
        env: { GITHUB_TOKEN: "demo-token" } as Record<string, string>,
        status: "stopped" as const,
        autoRestart: true,
        maxRestarts: 3,
        restartCount: 2
      },
      {
        name: "Weather API Server",
        deviceId: "edge-device-003",
        command: "node",
        args: ["weather-server.js"],
        env: { API_KEY: "weather-key" } as Record<string, string>,
        status: "running" as const,
        autoRestart: true,
        maxRestarts: 3,
        restartCount: 0
      }
    ];

    // Add demo servers synchronously for initial setup
    demoServers.forEach((serverData) => {
      const id = randomUUID();
      const server: Server = {
        id,
        name: serverData.name,
        deviceId: serverData.deviceId,
        command: serverData.command,
        args: serverData.args,
        env: serverData.env,
        status: serverData.status,
        pid: serverData.status === 'running' ? Math.floor(Math.random() * 10000) + 1000 : null,
        autoRestart: serverData.autoRestart,
        maxRestarts: serverData.maxRestarts,
        restartCount: serverData.restartCount,
        uptime: serverData.status === 'running' ? new Date(Date.now() - Math.random() * 3600000) : null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.servers.set(id, server);
    });
  }

  // Server operations
  async getServer(id: string): Promise<Server | undefined> {
    return this.servers.get(id);
  }

  async getAllServers(): Promise<Server[]> {
    return Array.from(this.servers.values());
  }

  async createServer(insertServer: InsertServer): Promise<Server> {
    const id = randomUUID();
    const server: Server = {
      id,
      name: insertServer.name,
      deviceId: insertServer.deviceId,
      command: insertServer.command,
      args: insertServer.args || [] as string[],
      env: insertServer.env || {},
      status: insertServer.status || 'stopped',
      pid: null,
      autoRestart: insertServer.autoRestart ?? true,
      maxRestarts: insertServer.maxRestarts || 3,
      restartCount: insertServer.restartCount || 0,
      uptime: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.servers.set(id, server);
    
    // Also create in MCP manager if available
    try {
      await this.mcpManager.createServer(insertServer);
    } catch (error) {
      console.error('Failed to create MCP server:', error);
    }
    
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
    const server = this.servers.get(id);
    if (!server) {
      return false;
    }
    
    // Stop and remove from MCP manager first
    try {
      await this.mcpManager.removeServer(id);
    } catch (error) {
      console.error('Failed to remove MCP server:', error);
    }
    
    // Clear server logs
    this.serverLogs.delete(id);
    
    // Remove from storage
    const deleted = this.servers.delete(id);
    
    if (deleted) {
      console.log(`Server ${server.name} (${id}) deleted successfully`);
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
      id: insertDevice.id,
      name: insertDevice.name,
      status: insertDevice.status || 'offline',
      lastSeen: insertDevice.lastSeen || null,
      metadata: insertDevice.metadata || {},
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

  async getServersByDevice(deviceId: string): Promise<Server[]> {
    return Array.from(this.servers.values()).filter(server => server.deviceId === deviceId);
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

  // Monitoring operations
  private systemMetrics: any[] = [];
  private serverMetricsMap: Map<string, any[]> = new Map();
  private alerts: any[] = [];

  async getSystemMetrics(limit: number = 100): Promise<any[]> {
    return this.systemMetrics.slice(-limit);
  }

  async addSystemMetrics(metrics: any): Promise<any> {
    const metric = {
      ...metrics,
      id: randomUUID(),
      timestamp: new Date(),
    };
    this.systemMetrics.push(metric);
    // Keep only last 1000 metrics
    if (this.systemMetrics.length > 1000) {
      this.systemMetrics = this.systemMetrics.slice(-1000);
    }
    return metric;
  }

  async getServerMetrics(serverId: string, limit: number = 100): Promise<any[]> {
    const metrics = this.serverMetricsMap.get(serverId) || [];
    return metrics.slice(-limit);
  }

  async addServerMetrics(metrics: any): Promise<any> {
    const metric = {
      ...metrics,
      id: randomUUID(),
      timestamp: new Date(),
    };
    
    if (!this.serverMetricsMap.has(metrics.serverId)) {
      this.serverMetricsMap.set(metrics.serverId, []);
    }
    
    const serverMetrics = this.serverMetricsMap.get(metrics.serverId)!;
    serverMetrics.push(metric);
    
    // Keep only last 1000 metrics per server
    if (serverMetrics.length > 1000) {
      this.serverMetricsMap.set(metrics.serverId, serverMetrics.slice(-1000));
    }
    
    return metric;
  }

  async getAlerts(active: boolean = true): Promise<any[]> {
    if (active) {
      return this.alerts.filter(a => !a.resolved);
    }
    return this.alerts;
  }

  async addAlert(alert: any): Promise<any> {
    const newAlert = {
      ...alert,
      id: randomUUID(),
      resolved: false,
      timestamp: new Date(),
    };
    this.alerts.push(newAlert);
    return newAlert;
  }

  async resolveAlert(id: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === id);
    if (alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }
}

export const storage = new MemStorage();
