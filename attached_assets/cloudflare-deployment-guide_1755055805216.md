# Cloudflare MCP Manager - Quick Deployment Guide

## Your Account Resources

**Account ID**: `523d80131d8cba13f765b80d6bb9e096`

**Created KV Namespaces**:
- `mcp_config`: `da1294711f1942749a6996bf3f35fe90`
- `mcp_device_tokens`: `accf88bbd2b24eaba87de3722e4c1588`  
- `mcp_server_state`: `c59b2dff9bcb46978f3b552885d7bf8a`

## Step 1: Enable Required Services

1. **Enable R2 Storage** (for logs):
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Navigate to R2 → Overview
   - Click "Enable R2"
   - Create bucket: `mcp-logs`

2. **Enable Durable Objects**:
   - Go to Workers & Pages → Settings
   - Enable Durable Objects

## Step 2: Deploy the Worker

Create `wrangler.toml` with your KV namespace IDs:

```toml
name = "mcp-manager"
main = "src/index.ts"
compatibility_date = "2024-01-01"
node_compat = true
account_id = "523d80131d8cba13f765b80d6bb9e096"

[[kv_namespaces]]
binding = "KV_CONFIG"
id = "da1294711f1942749a6996bf3f35fe90"

[[kv_namespaces]]
binding = "KV_DEVICE_TOKENS"
id = "accf88bbd2b24eaba87de3722e4c1588"

[[kv_namespaces]]
binding = "KV_SERVER_STATE"
id = "c59b2dff9bcb46978f3b552885d7bf8a"

[[r2_buckets]]
binding = "R2_LOGS"
bucket_name = "mcp-logs"

[[durable_objects.bindings]]
name = "SERVERS"
class_name = "ServerManager"

[[durable_objects.bindings]]
name = "CONNECTIONS"
class_name = "ConnectionHub"

[env.production]
routes = [
  { pattern = "mcp-api.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

Deploy with:
```bash
npm install
npm run build
wrangler deploy --env production
```

## Step 3: Setup Cloudflare Access

1. Go to Zero Trust → Access → Applications
2. Click "Add an application" → Self-hosted
3. Configure:
   - **Name**: MCP Manager
   - **Domain**: `mcp.yourdomain.com`
   - **Session Duration**: 24h

4. Create Access Policy:
   - **Name**: MCP Admin Access
   - **Action**: Allow
   - **Include**: Your email domain or specific emails

5. Generate Service Token (for AI):
   - Go to Access → Service Auth
   - Create token named "AI-MCP-Service"
   - Save the Client ID and Client Secret

## Step 4: Deploy Frontend to Pages

1. Connect GitHub repository:
   ```bash
   git init
   git remote add origin https://github.com/yourusername/mcp-manager
   git add .
   git commit -m "Initial MCP Manager"
   git push -u origin main
   ```

2. In Cloudflare Dashboard:
   - Go to Pages → Create a project
   - Connect GitHub account
   - Select your repository
   - Build settings:
     - Framework preset: React
     - Build command: `npm run build`
     - Build output directory: `dist`
     - Root directory: `pages`

3. Add environment variables:
   ```
   VITE_WORKER_URL=https://mcp-api.yourdomain.com
   VITE_ACCOUNT_ID=523d80131d8cba13f765b80d6bb9e096
   ```

## Step 5: Setup Cloudflare Tunnel for Edge Devices

1. Create tunnel:
   ```bash
   cloudflared tunnel create mcp-edge-devices
   ```

2. Save credentials:
   ```bash
   # This creates ~/.cloudflared/<TUNNEL_ID>.json
   # Copy this file to edge devices
   ```

3. Create config file `config.yml`:
   ```yaml
   tunnel: <TUNNEL_ID>
   credentials-file: /etc/cloudflared/<TUNNEL_ID>.json
   
   ingress:
     - hostname: edge-*.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```

## Step 6: Deploy Edge Agent

On each edge device:

1. **Install Edge Agent**:
   ```bash
   # Clone the edge agent code
   git clone https://github.com/yourusername/mcp-edge-agent
   cd mcp-edge-agent
   
   # Build Docker image
   docker build -t mcp-edge-agent .
   ```

2. **Create configuration** (`config.json`):
   ```json
   {
     "deviceId": "edge-device-001",
     "serviceToken": "YOUR_SERVICE_TOKEN",
     "workerUrl": "https://mcp-api.yourdomain.com",
     "mcpServers": [
       {
         "name": "filesystem-server",
         "command": "npx",
         "args": ["@modelcontextprotocol/server-filesystem", "/data"]
       },
       {
         "name": "github-server",
         "command": "npx",
         "args": ["@modelcontextprotocol/server-github"],
         "env": {
           "GITHUB_TOKEN": "your-github-token"
         }
       }
     ]
   }
   ```

3. **Run with Docker Compose**:
   ```yaml
   version: '3.8'
   
   services:
     cloudflared:
       image: cloudflare/cloudflared:latest
       command: tunnel run
       volumes:
         - ./config.yml:/etc/cloudflared/config.yml
         - ./.cloudflared:/etc/cloudflared
       restart: unless-stopped
   
     mcp-agent:
       image: mcp-edge-agent:latest
       volumes:
         - ./config.json:/app/config.json
         - /var/run/docker.sock:/var/run/docker.sock
       environment:
         - NODE_ENV=production
       depends_on:
         - cloudflared
       restart: unless-stopped
   ```

4. **Start services**:
   ```bash
   docker-compose up -d
   ```

## Step 7: Configure AI Integration

Create an AI client that uses your MCP servers:

```javascript
// ai-client.js
import { CloudflareAI } from '@cloudflare/ai';

const config = {
  accountId: '523d80131d8cba13f765b80d6bb9e096',
  apiToken: process.env.CF_API_TOKEN,
  mcpEndpoint: 'https://mcp-api.yourdomain.com',
  serviceToken: process.env.CF_SERVICE_TOKEN, // From Step 3
};

const ai = new CloudflareAI(config);

// Example: Execute MCP tool via AI
async function askAI(prompt) {
  const response = await fetch(`${config.mcpEndpoint}/api/mcp/execute`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.serviceToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      serverId: 'edge-device-001-filesystem',
      method: 'readFile',
      params: { path: '/data/config.yaml' }
    }),
  });
  
  const fileContent = await response.json();
  
  // Use with AI
  const aiResponse = await ai.run('@cf/meta/llama-2-7b-chat-int8', {
    messages: [
      { 
        role: 'system', 
        content: `You have access to this file content: ${fileContent}` 
      },
      { role: 'user', content: prompt }
    ],
  });
  
  return aiResponse;
}
```

## Step 8: Access Your MCP Manager

1. **Dashboard**: https://mcp.yourdomain.com
   - Login with Cloudflare Access
   - View all connected edge devices
   - Monitor MCP server status
   - Execute tools remotely

2. **API Endpoints**:
   - `GET https://mcp-api.yourdomain.com/api/servers` - List all servers
   - `POST https://mcp-api.yourdomain.com/api/mcp/execute` - Execute MCP methods
   - `WS wss://mcp-api.yourdomain.com/ws` - Real-time updates

3. **Monitoring**:
   - Cloudflare Analytics for request metrics
   - R2 bucket `mcp-logs` for centralized logging
   - KV namespace viewers in dashboard

## Security Checklist

✅ **Cloudflare Access** configured for UI authentication  
✅ **Service Tokens** for AI and edge device auth  
✅ **Cloudflare Tunnel** for secure edge connectivity  
✅ **KV Namespaces** for encrypted config storage  
✅ **Rate Limiting** via Cloudflare (automatic)  
✅ **DDoS Protection** via Cloudflare (automatic)  
✅ **SSL/TLS** encryption everywhere (automatic)

## Quick Test

Test your setup with curl:

```bash
# Get service token first
SERVICE_TOKEN="your-service-token-from-step-3"

# List connected servers
curl -H "Authorization: Bearer $SERVICE_TOKEN" \
  https://mcp-api.yourdomain.com/api/servers

# Execute MCP method
curl -X POST \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serverId":"test","method":"ping","params":{}}' \
  https://mcp-api.yourdomain.com/api/mcp/execute
```

## Troubleshooting

1. **Workers not deploying**: Ensure Durable Objects are enabled
2. **R2 errors**: Enable R2 in dashboard first
3. **Auth issues**: Check service token is valid and not expired
4. **Tunnel connection**: Verify cloudflared is running on edge device
5. **KV not working**: Check namespace IDs match in wrangler.toml

## Support Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Access Setup](https://developers.cloudflare.com/cloudflare-one/applications/)
- [Cloudflare Tunnel Guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [MCP Protocol Spec](https://modelcontextprotocol.io/docs)