/**
 * Cloudflare Worker for MCP Server Manager
 * Handles API requests and manages MCP servers across edge devices
 */

export interface Env {
  KV_CONFIG: KVNamespace;
  KV_DEVICE_TOKENS: KVNamespace;
  KV_SERVER_STATE: KVNamespace;
  R2_LOGS: R2Bucket;
  SERVERS: DurableObjectNamespace;
  CONNECTIONS: DurableObjectNamespace;
}

interface MCPServer {
  id: string;
  name: string;
  deviceId: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  status: 'running' | 'stopped' | 'error';
  autoRestart: boolean;
  maxRestarts: number;
  restartCount: number;
}

interface EdgeDevice {
  id: string;
  name: string;
  status: 'online' | 'offline';
  lastSeen: string | null;
  metadata: Record<string, any>;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (url.pathname.startsWith('/api/servers')) {
        return await handleServerAPI(request, env, url);
      }
      
      if (url.pathname.startsWith('/api/devices')) {
        return await handleDeviceAPI(request, env, url);
      }
      
      if (url.pathname.startsWith('/api/logs')) {
        return await handleLogsAPI(request, env, url);
      }
      
      if (url.pathname.startsWith('/api/stats')) {
        return await handleStatsAPI(request, env);
      }
      
      if (url.pathname === '/ws') {
        return await handleWebSocket(request, env);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  },
};

async function handleServerAPI(request: Request, env: Env, url: URL): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const path = url.pathname.replace('/api/servers', '');
  const segments = path.split('/').filter(s => s);

  switch (request.method) {
    case 'GET':
      if (segments.length === 0) {
        // Get all servers
        const servers = await getAllServers(env);
        return new Response(JSON.stringify(servers), { headers: corsHeaders });
      } else if (segments.length === 1) {
        // Get specific server
        const server = await getServer(env, segments[0]);
        if (!server) {
          return new Response('Server not found', { status: 404, headers: corsHeaders });
        }
        return new Response(JSON.stringify(server), { headers: corsHeaders });
      }
      break;

    case 'POST':
      if (segments.length === 0) {
        // Create new server
        const serverData = await request.json() as Partial<MCPServer>;
        const server = await createServer(env, serverData);
        return new Response(JSON.stringify(server), { 
          status: 201, 
          headers: corsHeaders 
        });
      } else if (segments.length === 2) {
        const serverId = segments[0];
        const action = segments[1];
        
        switch (action) {
          case 'start':
            await startServer(env, serverId);
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
          case 'stop':
            await stopServer(env, serverId);
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
          case 'restart':
            await restartServer(env, serverId);
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }
      break;

    case 'DELETE':
      if (segments.length === 1) {
        await deleteServer(env, segments[0]);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
      break;
  }

  return new Response('Bad Request', { status: 400, headers: corsHeaders });
}

async function handleDeviceAPI(request: Request, env: Env, url: URL): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const devices = await getAllDevices(env);
  return new Response(JSON.stringify(devices), { headers: corsHeaders });
}

async function handleLogsAPI(request: Request, env: Env, url: URL): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const path = url.pathname.replace('/api/logs', '');
  const segments = path.split('/').filter(s => s);

  if (segments.length === 1) {
    const serverId = segments[0];
    const logs = await getServerLogs(env, serverId);
    return new Response(JSON.stringify(logs), { headers: corsHeaders });
  }

  return new Response('Bad Request', { status: 400, headers: corsHeaders });
}

async function handleStatsAPI(request: Request, env: Env): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const servers = await getAllServers(env);
  const devices = await getAllDevices(env);

  const stats = {
    runningServers: servers.filter(s => s.status === 'running').length,
    stoppedServers: servers.filter(s => s.status === 'stopped').length,
    errorServers: servers.filter(s => s.status === 'error').length,
    edgeDevices: devices.filter(d => d.status === 'online').length,
  };

  return new Response(JSON.stringify(stats), { headers: corsHeaders });
}

async function handleWebSocket(request: Request, env: Env): Promise<Response> {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();
  
  // Send initial connection message
  server.send(JSON.stringify({
    type: 'init',
    data: { message: 'Connected to MCP Server Manager' }
  }));

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

// KV Storage Operations
async function getAllServers(env: Env): Promise<MCPServer[]> {
  const serverKeys = await env.KV_SERVER_STATE.list();
  const servers: MCPServer[] = [];

  for (const key of serverKeys.keys) {
    const serverData = await env.KV_SERVER_STATE.get(key.name);
    if (serverData) {
      servers.push(JSON.parse(serverData));
    }
  }

  return servers;
}

async function getServer(env: Env, id: string): Promise<MCPServer | null> {
  const serverData = await env.KV_SERVER_STATE.get(`server:${id}`);
  return serverData ? JSON.parse(serverData) : null;
}

async function createServer(env: Env, data: Partial<MCPServer>): Promise<MCPServer> {
  const server: MCPServer = {
    id: data.id || crypto.randomUUID(),
    name: data.name || 'Unnamed Server',
    deviceId: data.deviceId || 'unknown',
    command: data.command || 'echo',
    args: data.args || [],
    env: data.env || {},
    status: 'stopped',
    autoRestart: data.autoRestart ?? true,
    maxRestarts: data.maxRestarts || 3,
    restartCount: 0,
  };

  await env.KV_SERVER_STATE.put(`server:${server.id}`, JSON.stringify(server));
  return server;
}

async function startServer(env: Env, id: string): Promise<void> {
  const server = await getServer(env, id);
  if (server) {
    server.status = 'running';
    await env.KV_SERVER_STATE.put(`server:${id}`, JSON.stringify(server));
  }
}

async function stopServer(env: Env, id: string): Promise<void> {
  const server = await getServer(env, id);
  if (server) {
    server.status = 'stopped';
    await env.KV_SERVER_STATE.put(`server:${id}`, JSON.stringify(server));
  }
}

async function restartServer(env: Env, id: string): Promise<void> {
  const server = await getServer(env, id);
  if (server) {
    server.status = 'running';
    server.restartCount += 1;
    await env.KV_SERVER_STATE.put(`server:${id}`, JSON.stringify(server));
  }
}

async function deleteServer(env: Env, id: string): Promise<void> {
  await env.KV_SERVER_STATE.delete(`server:${id}`);
}

async function getAllDevices(env: Env): Promise<EdgeDevice[]> {
  // Mock devices for now - in real implementation, these would be stored in KV
  return [
    {
      id: 'edge-device-001',
      name: 'Production Server 1',
      status: 'online',
      lastSeen: new Date().toISOString(),
      metadata: { region: 'us-east-1', version: '1.0.0' }
    },
    {
      id: 'edge-device-002',
      name: 'Development Server',
      status: 'offline',
      lastSeen: new Date(Date.now() - 300000).toISOString(),
      metadata: { region: 'us-west-2', version: '1.0.0' }
    }
  ];
}

async function getServerLogs(env: Env, serverId: string): Promise<any[]> {
  // In a real implementation, logs would be stored in R2
  return [];
}