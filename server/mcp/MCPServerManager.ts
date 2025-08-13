import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type { Server as ServerType, InsertServer } from '../../shared/schema';

export interface MCPServerConfig {
  id: string;
  name: string;
  deviceId: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  autoRestart?: boolean;
  maxRestarts?: number;
}

export class MCPServerInstance extends EventEmitter {
  private config: MCPServerConfig;
  private process?: ChildProcess;
  private restartCount: number = 0;
  private status: 'stopped' | 'running' | 'error' = 'stopped';
  private logs: string[] = [];
  private uptime?: Date;

  constructor(config: MCPServerConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.status === 'running') {
      throw new Error(`Server ${this.config.name} is already running`);
    }

    try {
      // Spawn the actual MCP server process
      this.process = spawn(this.config.command, this.config.args, {
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // MCP server process spawned successfully
      // In a real implementation, we would use the MCP SDK to communicate with the process

      this.setupEventHandlers();
      this.status = 'running';
      this.uptime = new Date();
      
      this.addLog('info', `Server ${this.config.name} started successfully`);
      this.emit('started', this.getStatus());
      
    } catch (error) {
      this.status = 'error';
      this.addLog('error', `Failed to start server: ${error}`);
      this.emit('error', { id: this.config.id, error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.addLog('info', `Stopping server ${this.config.name}`);
    
    if (this.process) {
      this.process.kill('SIGTERM');
      
      // Give it 5 seconds to gracefully shut down
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      if (this.process && !this.process.killed) {
        this.process.kill('SIGKILL');
        this.addLog('warn', 'Server process force killed');
      }
    }

    // Clean up MCP server resources if needed

    this.status = 'stopped';
    this.uptime = undefined;
    this.addLog('info', `Server ${this.config.name} stopped`);
    this.emit('stopped', this.getStatus());
  }

  async restart(): Promise<void> {
    this.addLog('info', `Restarting server ${this.config.name}`);
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 2000));
    this.restartCount++;
    await this.start();
  }

  private setupEventHandlers(): void {
    if (!this.process) return;

    this.process.stdout?.on('data', (data) => {
      const log = data.toString().trim();
      this.addLog('info', log);
      this.emit('log', { id: this.config.id, log, level: 'info' });
    });

    this.process.stderr?.on('data', (data) => {
      const log = data.toString().trim();
      this.addLog('error', log);
      this.emit('log', { id: this.config.id, log, level: 'error' });
    });

    this.process.on('exit', (code, signal) => {
      const exitMessage = `Process exited with code ${code}, signal ${signal}`;
      this.addLog('info', exitMessage);
      
      this.status = code === 0 ? 'stopped' : 'error';
      this.uptime = undefined;
      
      this.emit('exit', { id: this.config.id, code, signal });
      
      // Auto-restart if enabled and within limits
      if (this.config.autoRestart && 
          this.restartCount < (this.config.maxRestarts || 3) && 
          code !== 0) {
        this.addLog('info', `Auto-restarting server (attempt ${this.restartCount + 1})`);
        setTimeout(() => {
          this.restart().catch(error => {
            this.addLog('error', `Auto-restart failed: ${error}`);
          });
        }, 5000);
      }
    });

    this.process.on('error', (error) => {
      this.status = 'error';
      this.addLog('error', `Process error: ${error.message}`);
      this.emit('error', { id: this.config.id, error });
    });
  }

  private addLog(level: 'info' | 'warn' | 'error', message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    this.logs.push(logEntry);
    
    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
  }

  getStatus(): ServerType {
    return {
      id: this.config.id,
      name: this.config.name,
      deviceId: this.config.deviceId,
      command: this.config.command,
      args: this.config.args,
      env: this.config.env || {},
      status: this.status,
      pid: this.process?.pid || null,
      autoRestart: this.config.autoRestart ?? true,
      maxRestarts: this.config.maxRestarts || 3,
      restartCount: this.restartCount,
      uptime: this.uptime || null,
      lastError: this.status === 'error' ? this.logs.slice(-1)[0] : null,
      createdAt: new Date(), // This should be persisted
      updatedAt: new Date(),
    };
  }

  getLogs(): string[] {
    return [...this.logs];
  }
}

export class MCPServerManager extends EventEmitter {
  private servers: Map<string, MCPServerInstance> = new Map();

  async createServer(config: InsertServer): Promise<ServerType> {
    const serverId = `${config.deviceId}-${config.name}-${Date.now()}`;
    const mcpConfig: MCPServerConfig = {
      id: serverId,
      name: config.name,
      deviceId: config.deviceId,
      command: config.command,
      args: config.args || [],
      env: config.env || {},
      autoRestart: config.autoRestart ?? true,
      maxRestarts: config.maxRestarts || 3,
    };

    if (this.servers.has(mcpConfig.id)) {
      throw new Error(`Server with name ${mcpConfig.name} already exists`);
    }

    const server = new MCPServerInstance(mcpConfig);
    
    // Forward events
    server.on('started', (status) => this.emit('server:started', status));
    server.on('stopped', (status) => this.emit('server:stopped', status));
    server.on('error', (data) => this.emit('server:error', data));
    server.on('log', (data) => this.emit('server:log', data));

    this.servers.set(mcpConfig.id, server);
    return server.getStatus();
  }

  async startServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(`Server ${id} not found`);
    }
    await server.start();
  }

  async stopServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(`Server ${id} not found`);
    }
    await server.stop();
  }

  async restartServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(`Server ${id} not found`);
    }
    await server.restart();
  }

  async removeServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(`Server ${id} not found`);
    }
    
    await server.stop();
    this.servers.delete(id);
  }

  getServer(id: string): ServerType | undefined {
    const server = this.servers.get(id);
    return server?.getStatus();
  }

  getAllServers(): ServerType[] {
    return Array.from(this.servers.values()).map(server => server.getStatus());
  }

  getServerLogs(id: string): string[] {
    const server = this.servers.get(id);
    return server?.getLogs() || [];
  }
}