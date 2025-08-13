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

  app.get('/api/devices/:id', async (req, res) => {
    try {
      const device = await storage.getEdgeDevice(req.params.id);
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }
      res.json(device);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch device' });
    }
  });

  app.post('/api/devices', async (req, res) => {
    try {
      const validatedData = insertEdgeDeviceSchema.parse(req.body);
      const device = await storage.createEdgeDevice(validatedData);
      
      broadcast({
        type: 'device_created',
        data: device
      });

      res.status(201).json(device);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create device' });
    }
  });

  app.delete('/api/devices/:id', async (req, res) => {
    try {
      // Check if device has any active servers
      const servers = await storage.getServersByDevice(req.params.id);
      if (servers.length > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete device with active servers',
          serverCount: servers.length 
        });
      }

      const deleted = await storage.deleteEdgeDevice(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Device not found' });
      }

      broadcast({
        type: 'device_deleted',
        data: { id: req.params.id }
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete device' });
    }
  });

  app.post('/api/devices/:id/heartbeat', async (req, res) => {
    try {
      // Check if device is blocked
      const device = await storage.getEdgeDevice(req.params.id);
      if (device?.blocked) {
        return res.status(403).json({ 
          error: 'Device is blocked', 
          reason: device.blockedReason 
        });
      }

      const updatedDevice = await storage.updateEdgeDevice(req.params.id, {
        status: 'online',
        lastSeen: new Date(),
      });

      if (updatedDevice) {
        broadcast({
          type: 'device_updated',
          data: updatedDevice
        });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update device heartbeat' });
    }
  });

  // Block/unblock device endpoints
  app.post('/api/devices/:id/block', async (req, res) => {
    try {
      const { reason } = req.body;
      const device = await storage.getEdgeDevice(req.params.id);
      
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      const updatedDevice = await storage.updateEdgeDevice(req.params.id, {
        blocked: true,
        blockedReason: reason || 'Security policy violation',
        blockedAt: new Date(),
        status: 'blocked' as any,
      });

      if (updatedDevice) {
        // Disconnect any active WebSocket connections for this device
        broadcast({
          type: 'device_blocked',
          data: updatedDevice
        });

        // TODO: Force disconnect WebSocket for this device
      }

      res.json({ success: true, device: updatedDevice });
    } catch (error) {
      res.status(500).json({ error: 'Failed to block device' });
    }
  });

  app.post('/api/devices/:id/unblock', async (req, res) => {
    try {
      const device = await storage.getEdgeDevice(req.params.id);
      
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      const updatedDevice = await storage.updateEdgeDevice(req.params.id, {
        blocked: false,
        blockedReason: null,
        blockedAt: null,
        status: 'offline' as any,
      });

      if (updatedDevice) {
        broadcast({
          type: 'device_unblocked',
          data: updatedDevice
        });
      }

      res.json({ success: true, device: updatedDevice });
    } catch (error) {
      res.status(500).json({ error: 'Failed to unblock device' });
    }
  });

  // Cloudflare tunnel detection endpoint
  app.post('/api/devices/register-tunnel', async (req, res) => {
    try {
      const { tunnelId, tunnelName, clientIp, region } = req.body;
      
      // Check if device already exists
      let device = await storage.getEdgeDevice(tunnelId);
      
      if (!device) {
        // Auto-register new device from Cloudflare tunnel
        device = await storage.createEdgeDevice({
          id: tunnelId,
          name: tunnelName || `Cloudflare Tunnel ${tunnelId.slice(0, 8)}`,
          status: 'online',
          lastSeen: new Date(),
          metadata: {
            type: 'cloudflare-tunnel',
            clientIp: clientIp || '',
            region: region || '',
            autoRegistered: true,
            registeredAt: new Date().toISOString()
          }
        });

        broadcast({
          type: 'device_created',
          data: device
        });

        console.log(`Auto-registered new device from Cloudflare tunnel: ${device.name}`);
      } else {
        // Update existing device
        device = await storage.updateEdgeDevice(tunnelId, {
          status: 'online',
          lastSeen: new Date(),
          metadata: {
            ...device.metadata,
            lastClientIp: clientIp,
            lastRegion: region,
            lastSeen: new Date().toISOString()
          }
        });

        broadcast({
          type: 'device_updated',
          data: device
        });
      }

      res.json({ success: true, device });
    } catch (error) {
      console.error('Failed to register tunnel device:', error);
      res.status(500).json({ error: 'Failed to register tunnel device' });
    }
  });

  // Middleware to detect Cloudflare tunnel connections
  app.use((req, res, next) => {
    // Check for Cloudflare headers
    const cfRay = req.headers['cf-ray'];
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    const cfIpcountry = req.headers['cf-ipcountry'];
    const cfTunnelId = req.headers['cf-access-authenticated-user-email'] || req.headers['cf-worker'];
    
    if (cfRay && cfConnectingIp) {
      // This is a Cloudflare connection
      const tunnelId = cfTunnelId || `cf-tunnel-${(cfRay as string).slice(0, 8)}`;
      
      // Auto-register tunnel device if not already registered
      storage.getEdgeDevice(tunnelId).then(device => {
        if (!device) {
          console.log(`Detected new Cloudflare tunnel connection: ${tunnelId}`);
          
          storage.createEdgeDevice({
            id: tunnelId,
            name: `Cloudflare Tunnel (${cfIpcountry || 'Unknown Region'})`,
            status: 'online',
            lastSeen: new Date(),
            metadata: {
              type: 'cloudflare-tunnel',
              clientIp: cfConnectingIp as string,
              region: cfIpcountry as string || '',
              cfRay: cfRay as string,
              autoRegistered: true,
              detectedAt: new Date().toISOString()
            }
          }).then(newDevice => {
            broadcast({
              type: 'device_created',
              data: newDevice
            });
            console.log(`Auto-registered Cloudflare tunnel device: ${newDevice.name}`);
          });
        }
      }).catch(err => {
        console.error('Error checking tunnel device:', err);
      });
    }
    
    next();
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
      servers.filter(s => (s.restartCount || 0) > 2).forEach(server => {
        alerts.push({
          id: `alert-restart-${server.id}`,
          title: 'High Restart Count',
          message: `Server "${server.name}" has restarted ${server.restartCount || 0} times`,
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
