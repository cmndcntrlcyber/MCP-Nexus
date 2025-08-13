import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertServerSchema, insertEdgeDeviceSchema, insertServerLogSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { promises as fs } from "fs";
import path from "path";

// Configure multer for file uploads
const upload = multer({ 
  dest: '/tmp/certificates/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.pem', '.crt', '.cer'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only .pem, .crt, and .cer files are allowed.'));
    }
  }
});

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

  // Configuration routes
  app.get('/api/config', async (req, res) => {
    try {
      const config = await storage.getConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch configuration' });
    }
  });

  app.post('/api/config', async (req, res) => {
    try {
      const config = await storage.saveConfig(req.body);
      
      broadcast({
        type: 'config_updated',
        data: config
      });

      res.json({ success: true, config });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save configuration' });
    }
  });

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
      // Get device first to ensure it exists
      const device = await storage.getEdgeDevice(req.params.id);
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      // Get all servers associated with this device
      const servers = await storage.getServersByDevice(req.params.id);
      
      // Stop and delete all servers on this device
      for (const server of servers) {
        try {
          // Stop the server if it's running
          if (server.status === 'running') {
            await storage.updateServer(server.id, { status: 'stopped', pid: null });
          }
          // Delete the server
          await storage.deleteServer(server.id);
          console.log(`Deleted server ${server.name} (${server.id}) from device ${req.params.id}`);
        } catch (err) {
          console.error(`Failed to delete server ${server.id}:`, err);
        }
      }

      // Now delete the device
      const deleted = await storage.deleteEdgeDevice(req.params.id);
      if (!deleted) {
        return res.status(500).json({ error: 'Failed to delete device after removing servers' });
      }

      // Broadcast updates
      broadcast({
        type: 'device_deleted',
        data: { 
          id: req.params.id,
          serversRemoved: servers.length 
        }
      });

      // Also broadcast server deletions
      for (const server of servers) {
        broadcast({
          type: 'server_deleted',
          data: { id: server.id }
        });
      }

      res.json({ 
        success: true, 
        message: `Device deleted successfully. ${servers.length} server(s) were removed.`,
        serversRemoved: servers.length 
      });
    } catch (error) {
      console.error('Failed to delete device:', error);
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

  // Certificate deployment routes
  app.post('/api/certificates/deploy', upload.fields([
    { name: 'edgeCertificate', maxCount: 1 },
    { name: 'clientCertificate', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const { orgSlug, tunnelDomain } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      if (!orgSlug || !tunnelDomain) {
        return res.status(400).json({ error: 'Organization slug and tunnel domain are required' });
      }

      if (!files.edgeCertificate && !files.clientCertificate) {
        return res.status(400).json({ error: 'At least one certificate must be provided' });
      }

      // Construct the tunnel endpoint
      const tunnelEndpoint = `https://${orgSlug}.${tunnelDomain}`;
      
      // Prepare certificate data
      const certificateData: any = {
        orgSlug,
        tunnelDomain,
        endpoint: tunnelEndpoint,
        timestamp: new Date().toISOString(),
      };

      // Read and include edge certificate if provided
      if (files.edgeCertificate && files.edgeCertificate[0]) {
        const edgeCertPath = files.edgeCertificate[0].path;
        const edgeCertContent = await fs.readFile(edgeCertPath, 'utf-8');
        certificateData.edgeCertificate = {
          filename: files.edgeCertificate[0].originalname,
          content: edgeCertContent,
          size: files.edgeCertificate[0].size,
        };
        // Clean up temporary file
        await fs.unlink(edgeCertPath).catch(() => {});
      }

      // Read and include client certificate if provided
      if (files.clientCertificate && files.clientCertificate[0]) {
        const clientCertPath = files.clientCertificate[0].path;
        const clientCertContent = await fs.readFile(clientCertPath, 'utf-8');
        certificateData.clientCertificate = {
          filename: files.clientCertificate[0].originalname,
          content: clientCertContent,
          size: files.clientCertificate[0].size,
        };
        // Clean up temporary file
        await fs.unlink(clientCertPath).catch(() => {});
      }

      // Store certificate configuration
      await storage.saveCertificateConfig(certificateData);

      // In a production environment, this would send the certificates to the actual tunnel endpoint
      // For now, we'll simulate the deployment
      console.log('Deploying certificates to tunnel:', tunnelEndpoint);
      console.log('Organization:', orgSlug);
      console.log('Domain:', tunnelDomain);
      if (certificateData.edgeCertificate) {
        console.log('Edge Certificate:', certificateData.edgeCertificate.filename);
      }
      if (certificateData.clientCertificate) {
        console.log('Client Certificate:', certificateData.clientCertificate.filename);
      }

      // Simulate deployment to tunnel endpoint
      // In production, this would make an HTTPS request to the tunnel endpoint
      // to register the certificates
      const deploymentResult = {
        success: true,
        endpoint: tunnelEndpoint,
        certificates: {
          edge: certificateData.edgeCertificate ? certificateData.edgeCertificate.filename : null,
          client: certificateData.clientCertificate ? certificateData.clientCertificate.filename : null,
        },
        deployedAt: new Date().toISOString(),
      };

      // Broadcast certificate deployment
      broadcast({
        type: 'certificates_deployed',
        data: {
          orgSlug,
          tunnelDomain,
          endpoint: tunnelEndpoint,
          certificates: deploymentResult.certificates,
        }
      });

      res.json(deploymentResult);
    } catch (error) {
      console.error('Certificate deployment error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to deploy certificates' 
      });
    }
  });

  // Get certificate configuration
  app.get('/api/certificates/config', async (req, res) => {
    try {
      const config = await storage.getCertificateConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch certificate configuration' });
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
