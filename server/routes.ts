import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertServerSchema, insertEdgeDeviceSchema, insertServerLogSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);
    
    ws.on('close', () => {
      clients.delete(ws);
    });

    // Send initial data
    ws.send(JSON.stringify({
      type: 'init',
      data: {
        message: 'Connected to MCP Server Manager'
      }
    }));
  });

  // Broadcast to all connected clients
  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  };

  // Server management routes
  app.get('/api/servers', async (req, res) => {
    try {
      const servers = await storage.getAllServers();
      res.json(servers);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch servers' });
    }
  });

  app.get('/api/servers/:id', async (req, res) => {
    try {
      const server = await storage.getServer(req.params.id);
      if (!server) {
        return res.status(404).json({ error: 'Server not found' });
      }
      res.json(server);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch server' });
    }
  });

  app.post('/api/servers', async (req, res) => {
    try {
      const validatedData = insertServerSchema.parse(req.body);
      const server = await storage.createServer(validatedData);
      
      broadcast({
        type: 'server_created',
        data: server
      });

      res.status(201).json(server);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create server' });
    }
  });

  app.post('/api/servers/:id/start', async (req, res) => {
    try {
      const server = await storage.getServer(req.params.id);
      if (!server) {
        return res.status(404).json({ error: 'Server not found' });
      }

      // Simulate starting the server
      const updatedServer = await storage.updateServer(req.params.id, {
        status: 'running',
        uptime: new Date(),
        pid: Math.floor(Math.random() * 10000) + 1000,
      });

      // Add log entry
      await storage.addServerLog({
        serverId: req.params.id,
        level: 'info',
        message: `Server started successfully`
      });

      broadcast({
        type: 'server_updated',
        data: updatedServer
      });

      res.json({ success: true, server: updatedServer });
    } catch (error) {
      res.status(500).json({ error: 'Failed to start server' });
    }
  });

  app.post('/api/servers/:id/stop', async (req, res) => {
    try {
      const server = await storage.getServer(req.params.id);
      if (!server) {
        return res.status(404).json({ error: 'Server not found' });
      }

      const updatedServer = await storage.updateServer(req.params.id, {
        status: 'stopped',
        uptime: null,
        pid: null,
      });

      await storage.addServerLog({
        serverId: req.params.id,
        level: 'info',
        message: `Server stopped manually`
      });

      broadcast({
        type: 'server_updated',
        data: updatedServer
      });

      res.json({ success: true, server: updatedServer });
    } catch (error) {
      res.status(500).json({ error: 'Failed to stop server' });
    }
  });

  app.post('/api/servers/:id/restart', async (req, res) => {
    try {
      const server = await storage.getServer(req.params.id);
      if (!server) {
        return res.status(404).json({ error: 'Server not found' });
      }

      const updatedServer = await storage.updateServer(req.params.id, {
        status: 'running',
        uptime: new Date(),
        pid: Math.floor(Math.random() * 10000) + 1000,
        restartCount: (server.restartCount || 0) + 1,
      });

      await storage.addServerLog({
        serverId: req.params.id,
        level: 'info',
        message: `Server restarted (restart count: ${updatedServer?.restartCount || 0})`
      });

      broadcast({
        type: 'server_updated',
        data: updatedServer
      });

      res.json({ success: true, server: updatedServer });
    } catch (error) {
      res.status(500).json({ error: 'Failed to restart server' });
    }
  });

  app.delete('/api/servers/:id', async (req, res) => {
    try {
      const deleted = await storage.deleteServer(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Server not found' });
      }

      broadcast({
        type: 'server_deleted',
        data: { id: req.params.id }
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete server' });
    }
  });

  // Edge device routes
  app.get('/api/devices', async (req, res) => {
    try {
      const devices = await storage.getAllEdgeDevices();
      res.json(devices);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch devices' });
    }
  });

  app.post('/api/devices/:id/heartbeat', async (req, res) => {
    try {
      const device = await storage.updateEdgeDevice(req.params.id, {
        status: 'online',
        lastSeen: new Date(),
      });

      if (device) {
        broadcast({
          type: 'device_updated',
          data: device
        });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update device heartbeat' });
    }
  });

  // Server logs routes
  app.get('/api/servers/:id/logs', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getServerLogs(req.params.id, limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  // Dashboard stats route
  app.get('/api/stats', async (req, res) => {
    try {
      const servers = await storage.getAllServers();
      const devices = await storage.getAllEdgeDevices();

      const stats = {
        runningServers: servers.filter(s => s.status === 'running').length,
        stoppedServers: servers.filter(s => s.status === 'stopped').length,
        errorServers: servers.filter(s => s.status === 'error').length,
        edgeDevices: devices.length,
        onlineDevices: devices.filter(d => d.status === 'online').length,
        offlineDevices: devices.filter(d => d.status === 'offline').length,
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // Monitoring endpoints
  app.get('/api/monitoring/metrics', async (req, res) => {
    try {
      // Simulate system metrics - in production this would use actual system monitoring
      const metrics = {
        cpu: Math.floor(Math.random() * 30 + 10), // 10-40%
        memory: Math.floor(Math.random() * 40 + 20), // 20-60%
        disk: Math.floor(Math.random() * 50 + 30), // 30-80%
        network: Math.floor(Math.random() * 1000000), // bytes per second
        timestamp: new Date().toISOString(),
      };

      // Broadcast metrics to WebSocket clients
      broadcast({
        type: 'metrics_update',
        data: metrics
      });

      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  });

  app.get('/api/monitoring/servers', async (req, res) => {
    try {
      const servers = await storage.getAllServers();
      const runningServers = servers.filter(s => s.status === 'running');
      
      const serverMetrics = runningServers.map(server => ({
        serverId: server.id,
        cpu: Math.floor(Math.random() * 80), // 0-80%
        memory: Math.floor(Math.random() * 512), // 0-512 MB
        requestsPerSecond: Math.floor(Math.random() * 100),
        avgResponseTime: Math.floor(Math.random() * 200), // 0-200ms
        errorRate: parseFloat((Math.random() * 5).toFixed(2)), // 0-5%
        uptime: server.uptime ? 
          Math.floor((new Date().getTime() - new Date(server.uptime).getTime()) / 1000) : 0
      }));

      // Broadcast server metrics to WebSocket clients
      serverMetrics.forEach(metric => {
        broadcast({
          type: 'server_metrics',
          data: metric
        });
      });

      res.json(serverMetrics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch server metrics' });
    }
  });

  app.get('/api/monitoring/alerts', async (req, res) => {
    try {
      const servers = await storage.getAllServers();
      const alerts: any[] = [];
      
      // Check for servers in error state
      servers.filter(s => s.status === 'error').forEach(server => {
        alerts.push({
          id: `alert-${server.id}`,
          title: 'Server Error',
          message: `Server "${server.name}" is in error state: ${server.lastError || 'Unknown error'}`,
          severity: 'high',
          timestamp: new Date().toISOString()
        });
      });

      // Check for high restart counts
      servers.filter(s => s.restartCount > 2).forEach(server => {
        alerts.push({
          id: `alert-restart-${server.id}`,
          title: 'High Restart Count',
          message: `Server "${server.name}" has restarted ${server.restartCount} times`,
          severity: 'medium',
          timestamp: new Date().toISOString()
        });
      });

      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  });

  app.get('/api/monitoring/health', async (req, res) => {
    try {
      const servers = await storage.getAllServers();
      const devices = await storage.getAllEdgeDevices();
      
      const health = {
        healthy: servers.filter(s => s.status === 'running').length === servers.length,
        totalServers: servers.length,
        healthyServers: servers.filter(s => s.status === 'running').length,
        totalDevices: devices.length,
        onlineDevices: devices.filter(d => d.status === 'online').length,
        timestamp: new Date().toISOString()
      };

      res.json(health);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch health status' });
    }
  });

  // Simulate some log entries for demo
  setTimeout(async () => {
    const servers = await storage.getAllServers();
    if (servers.length > 0) {
      setInterval(async () => {
        const randomServer = servers[Math.floor(Math.random() * servers.length)];
        if (randomServer.status === 'running') {
          const logMessages = [
            'Processing request from client',
            'File system scan completed',
            'Connection established',
            'Heartbeat received',
            'Cache updated successfully',
          ];
          
          const log = await storage.addServerLog({
            serverId: randomServer.id,
            level: 'info',
            message: logMessages[Math.floor(Math.random() * logMessages.length)]
          });

          broadcast({
            type: 'log_added',
            data: log
          });
        }
      }, 3000 + Math.random() * 5000);
    }
  }, 1000);

  // Simulate periodic metrics updates
  setInterval(async () => {
    const metrics = {
      cpu: Math.floor(Math.random() * 30 + 10),
      memory: Math.floor(Math.random() * 40 + 20),
      disk: Math.floor(Math.random() * 50 + 30),
      network: Math.floor(Math.random() * 1000000),
      timestamp: new Date().toISOString(),
    };

    broadcast({
      type: 'metrics_update',
      data: metrics
    });
  }, 5000);

  return httpServer;
}
