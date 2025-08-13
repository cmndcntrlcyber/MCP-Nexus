# MCP Server Manager - Complete Implementation

## Project Structure

```
mcp-server-manager/
├── backend/
│   ├── src/
│   │   ├── server.ts
│   │   ├── mcp/
│   │   │   ├── MCPServer.ts
│   │   │   ├── MCPManager.ts
│   │   │   └── types.ts
│   │   ├── api/
│   │   │   └── routes.ts
│   │   └── websocket/
│   │       └── handler.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ServerList.tsx
│   │   │   ├── ServerDetails.tsx
│   │   │   ├── ServerControl.tsx
│   │   │   └── Dashboard.tsx
│   │   └── services/
│   │       └── api.ts
│   ├── package.json
│   └── vite.config.ts
└── docker-compose.yml
```

## Backend Implementation

### 1. Core MCP Server (`backend/src/mcp/MCPServer.ts`)

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';

export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  autoRestart?: boolean;
  maxRestarts?: number;
}

export class MCPServer extends EventEmitter {
  private config: MCPServerConfig;
  private process?: ChildProcess;
  private server?: Server;
  private restartCount: number = 0;
  private status: 'stopped' | 'running' | 'error' = 'stopped';
  private logs: string[] = [];

  constructor(config: MCPServerConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.status === 'running') {
      throw new Error(`Server ${this.config.name} is already running`);
    }

    try {
      this.process = spawn(this.config.command, this.config.args, {
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.server = new Server({
        name: this.config.name,
        version: '1.0.0',
      }, {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      });

      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      this.setupEventHandlers();
      this.status = 'running';
      this.emit('started', this.config.id);
      
    } catch (error) {
      this.status = 'error';
      this.emit('error', { id: this.config.id, error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (this.process.killed === false) {
        this.process.kill('SIGKILL');
      }
    }

    if (this.server) {
      await this.server.close();
    }

    this.status = 'stopped';
    this.emit('stopped', this.config.id);
  }

  private setupEventHandlers(): void {
    if (!this.process) return;

    this.process.stdout?.on('data', (data) => {
      const log = data.toString();
      this.logs.push(`[STDOUT] ${log}`);
      this.emit('log', { id: this.config.id, log });
    });

    this.process.stderr?.on('data', (data) => {
      const log = data.toString();
      this.logs.push(`[STDERR] ${log}`);
      this.emit('log', { id: this.config.id, log, type: 'error' });
    });

    this.process.on('exit', (code) => {
      this.status = 'stopped';
      this.emit('exit', { id: this.config.id, code });
      
      if (this.config.autoRestart && this.restartCount < (this.config.maxRestarts || 3)) {
        this.restartCount++;
        setTimeout(() => this.start(), 5000);
      }
    });
  }

  getStatus() {
    return {
      id: this.config.id,
      name: this.config.name,
      status: this.status,
      restartCount: this.restartCount,
      logs: this.logs.slice(-100)
    };
  }
}
```

### 2. MCP Manager (`backend/src/mcp/MCPManager.ts`)

```typescript
import { MCPServer, MCPServerConfig } from './MCPServer';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export class MCPManager extends EventEmitter {
  private servers: Map<string, MCPServer> = new Map();
  private configPath: string;

  constructor(configPath: string = './config/servers.json') {
    super();
    this.configPath = configPath;
  }

  async loadServers(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const configs: MCPServerConfig[] = JSON.parse(data);
      
      for (const config of configs) {
        await this.addServer(config);
      }
    } catch (error) {
      console.error('Failed to load server configs:', error);
    }
  }

  async addServer(config: MCPServerConfig): Promise<void> {
    if (this.servers.has(config.id)) {
      throw new Error(`Server with ID ${config.id} already exists`);
    }

    const server = new MCPServer(config);
    
    server.on('started', (id) => this.emit('server:started', id));
    server.on('stopped', (id) => this.emit('server:stopped', id));
    server.on('error', (data) => this.emit('server:error', data));
    server.on('log', (data) => this.emit('server:log', data));

    this.servers.set(config.id, server);
    await this.saveConfigs();
  }

  async removeServer(id: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server) {
      throw new Error(`Server ${id} not found`);
    }

    await server.stop();
    this.servers.delete(id);
    await this.saveConfigs();
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
    await this.stopServer(id);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.startServer(id);
  }

  getServerStatus(id: string) {
    const server = this.servers.get(id);
    return server?.getStatus();
  }

  getAllServers() {
    return Array.from(this.servers.values()).map(server => server.getStatus());
  }

  private async saveConfigs(): Promise<void> {
    const configs = Array.from(this.servers.values()).map(server => 
      server['config']
    );
    await fs.writeFile(this.configPath, JSON.stringify(configs, null, 2));
  }
}
```

### 3. Express API Server (`backend/src/server.ts`)

```typescript
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { MCPManager } from './mcp/MCPManager';
import { setupRoutes } from './api/routes';
import { setupWebSocket } from './websocket/handler';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const mcpManager = new MCPManager();

app.use(cors());
app.use(express.json());

// Setup API routes
setupRoutes(app, mcpManager);

// Setup WebSocket handlers
setupWebSocket(io, mcpManager);

// Start server
const PORT = process.env.PORT || 3000;

async function start() {
  await mcpManager.loadServers();
  
  httpServer.listen(PORT, () => {
    console.log(`MCP Server Manager running on port ${PORT}`);
  });
}

start().catch(console.error);
```

### 4. API Routes (`backend/src/api/routes.ts`)

```typescript
import { Express } from 'express';
import { MCPManager } from '../mcp/MCPManager';

export function setupRoutes(app: Express, manager: MCPManager) {
  // Get all servers
  app.get('/api/servers', (req, res) => {
    const servers = manager.getAllServers();
    res.json(servers);
  });

  // Get specific server
  app.get('/api/servers/:id', (req, res) => {
    const status = manager.getServerStatus(req.params.id);
    if (!status) {
      return res.status(404).json({ error: 'Server not found' });
    }
    res.json(status);
  });

  // Add new server
  app.post('/api/servers', async (req, res) => {
    try {
      await manager.addServer(req.body);
      res.status(201).json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Start server
  app.post('/api/servers/:id/start', async (req, res) => {
    try {
      await manager.startServer(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Stop server
  app.post('/api/servers/:id/stop', async (req, res) => {
    try {
      await manager.stopServer(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Restart server
  app.post('/api/servers/:id/restart', async (req, res) => {
    try {
      await manager.restartServer(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete server
  app.delete('/api/servers/:id', async (req, res) => {
    try {
      await manager.removeServer(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
}
```

## Frontend Implementation

### 1. Main App Component (`frontend/src/App.tsx`)

```tsx
import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { ServerList } from './components/ServerList';
import { ServerDetails } from './components/ServerDetails';
import { io, Socket } from 'socket.io-client';
import { api } from './services/api';

interface Server {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  restartCount: number;
  logs: string[];
}

function App() {
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    
    newSocket.on('server:update', (data) => {
      setServers(prev => prev.map(s => 
        s.id === data.id ? { ...s, ...data } : s
      ));
    });

    newSocket.on('server:log', (data) => {
      setServers(prev => prev.map(s => 
        s.id === data.id 
          ? { ...s, logs: [...s.logs, data.log].slice(-100) }
          : s
      ));
    });

    setSocket(newSocket);
    loadServers();

    return () => {
      newSocket.close();
    };
  }, []);

  const loadServers = async () => {
    const data = await api.getServers();
    setServers(data);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            MCP Server Manager
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Dashboard servers={servers} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-1">
            <ServerList 
              servers={servers}
              selectedServer={selectedServer}
              onSelectServer={setSelectedServer}
              onRefresh={loadServers}
            />
          </div>
          
          <div className="lg:col-span-2">
            {selectedServer && (
              <ServerDetails 
                server={servers.find(s => s.id === selectedServer)}
                onRefresh={loadServers}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
```

### 2. Server List Component (`frontend/src/components/ServerList.tsx`)

```tsx
import React, { useState } from 'react';
import { api } from '../services/api';

interface Server {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
}

interface Props {
  servers: Server[];
  selectedServer: string | null;
  onSelectServer: (id: string) => void;
  onRefresh: () => void;
}

export function ServerList({ servers, selectedServer, onSelectServer, onRefresh }: Props) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newServer, setNewServer] = useState({
    name: '',
    command: '',
    args: ''
  });

  const handleAddServer = async () => {
    await api.addServer({
      id: Date.now().toString(),
      name: newServer.name,
      command: newServer.command,
      args: newServer.args.split(' '),
      autoRestart: true,
      maxRestarts: 3
    });
    setShowAddModal(false);
    setNewServer({ name: '', command: '', args: '' });
    onRefresh();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'stopped': return 'bg-gray-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Servers</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Server
        </button>
      </div>

      <div className="space-y-2">
        {servers.map(server => (
          <div
            key={server.id}
            onClick={() => onSelectServer(server.id)}
            className={`p-3 rounded cursor-pointer transition ${
              selectedServer === server.id 
                ? 'bg-blue-50 border-blue-500 border' 
                : 'hover:bg-gray-50 border-transparent border'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{server.name}</span>
              <span className={`w-3 h-3 rounded-full ${getStatusColor(server.status)}`} />
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Status: {server.status}
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Add New Server</h3>
            
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Server Name"
                value={newServer.name}
                onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
              
              <input
                type="text"
                placeholder="Command"
                value={newServer.command}
                onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
              
              <input
                type="text"
                placeholder="Arguments (space-separated)"
                value={newServer.args}
                onChange={(e) => setNewServer({ ...newServer, args: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddServer}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Docker Configuration

### `docker-compose.yml`

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    volumes:
      - ./backend/config:/app/config
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - NODE_ENV=production
    networks:
      - mcp-network

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend
    networks:
      - mcp-network

networks:
  mcp-network:
    driver: bridge
```

### Backend Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

## Package.json Files

### Backend (`backend/package.json`)

```json
{
  "name": "mcp-server-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "express": "^4.18.2",
    "socket.io": "^4.6.1",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "ts-node-dev": "^2.0.0"
  }
}
```

### Frontend (`frontend/package.json`)

```json
{
  "name": "mcp-server-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "socket.io-client": "^4.6.1",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}
```

## Getting Started

1. **Clone and Setup**:
```bash
git clone <your-repo>
cd mcp-server-manager

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies  
cd ../frontend && npm install
```

2. **Development Mode**:
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

3. **Production with Docker**:
```bash
docker-compose up --build
```

4. **Access the Application**:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Features

- **Real-time Monitoring**: Live server status updates via WebSocket
- **Log Streaming**: Real-time log viewing for each server
- **Auto-restart**: Configurable automatic restart on failure
- **Persistent Configuration**: Server configs saved to disk
- **Docker Support**: Easy deployment with Docker Compose
- **RESTful API**: Full CRUD operations for server management
- **Responsive UI**: Modern React frontend with Tailwind CSS

## API Endpoints

- `GET /api/servers` - List all servers
- `GET /api/servers/:id` - Get server details
- `POST /api/servers` - Add new server
- `POST /api/servers/:id/start` - Start server
- `POST /api/servers/:id/stop` - Stop server
- `POST /api/servers/:id/restart` - Restart server
- `DELETE /api/servers/:id` - Remove server

## WebSocket Events

- `server:started` - Server started successfully
- `server:stopped` - Server stopped
- `server:error` - Server encountered error
- `server:log` - New log entry from server
- `server:update` - Server status changed