import { useState, useCallback } from "react";
import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWebSocket, type WebSocketMessage } from "@/lib/websocket";

export default function ConfigPage() {
  const [connectionStatus, setConnectionStatus] = useState(false);
  const [config, setConfig] = useState({
    cloudflareAccountId: '523d80131d8cba13f765b80d6bb9e096',
    workerUrl: 'https://mcp-api.yourdomain.com',
    kvNamespaces: {
      config: 'da1294711f1942749a6996bf3f35fe90',
      deviceTokens: 'accf88bbd2b24eaba87de3722e4c1588',
      serverState: 'c59b2dff9bcb46978f3b552885d7bf8a'
    },
    r2Bucket: 'mcp-logs',
    autoRestart: true,
    maxRestarts: 3,
    heartbeatInterval: 30000
  });

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'init':
        setConnectionStatus(true);
        break;
    }
  }, []);

  useWebSocket(handleWebSocketMessage);

  const handleSaveConfig = () => {
    // In a real implementation, this would save to the backend
    console.log('Saving config:', config);
    alert('Configuration saved successfully!');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader connectionStatus={connectionStatus} />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Configuration</h1>
            <p className="text-gray-600">Manage system settings and Cloudflare integration</p>
          </div>

          <div className="space-y-6">
            {/* Cloudflare Settings */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <span className="material-icons text-blue-500 mr-2">cloud</span>
                Cloudflare Settings
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="accountId">Account ID</Label>
                  <Input
                    id="accountId"
                    value={config.cloudflareAccountId}
                    onChange={(e) => setConfig({...config, cloudflareAccountId: e.target.value})}
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="workerUrl">Worker URL</Label>
                  <Input
                    id="workerUrl"
                    value={config.workerUrl}
                    onChange={(e) => setConfig({...config, workerUrl: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="r2Bucket">R2 Bucket (Logs)</Label>
                  <Input
                    id="r2Bucket"
                    value={config.r2Bucket}
                    onChange={(e) => setConfig({...config, r2Bucket: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* KV Namespace Settings */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <span className="material-icons text-green-500 mr-2">storage</span>
                KV Namespace IDs
              </h3>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="kvConfig">Config Namespace</Label>
                  <Input
                    id="kvConfig"
                    value={config.kvNamespaces.config}
                    onChange={(e) => setConfig({
                      ...config, 
                      kvNamespaces: {...config.kvNamespaces, config: e.target.value}
                    })}
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="kvTokens">Device Tokens Namespace</Label>
                  <Input
                    id="kvTokens"
                    value={config.kvNamespaces.deviceTokens}
                    onChange={(e) => setConfig({
                      ...config, 
                      kvNamespaces: {...config.kvNamespaces, deviceTokens: e.target.value}
                    })}
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="kvState">Server State Namespace</Label>
                  <Input
                    id="kvState"
                    value={config.kvNamespaces.serverState}
                    onChange={(e) => setConfig({
                      ...config, 
                      kvNamespaces: {...config.kvNamespaces, serverState: e.target.value}
                    })}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Server Settings */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <span className="material-icons text-purple-500 mr-2">settings</span>
                Server Settings
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maxRestarts">Max Restarts</Label>
                  <Input
                    id="maxRestarts"
                    type="number"
                    value={config.maxRestarts}
                    onChange={(e) => setConfig({...config, maxRestarts: parseInt(e.target.value)})}
                  />
                </div>
                <div>
                  <Label htmlFor="heartbeat">Heartbeat Interval (ms)</Label>
                  <Input
                    id="heartbeat"
                    type="number"
                    value={config.heartbeatInterval}
                    onChange={(e) => setConfig({...config, heartbeatInterval: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              
              <div className="mt-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="autoRestart"
                    checked={config.autoRestart}
                    onChange={(e) => setConfig({...config, autoRestart: e.target.checked})}
                    className="rounded"
                  />
                  <Label htmlFor="autoRestart">Auto-restart failed servers</Label>
                </div>
              </div>
            </div>

            {/* Deployment Status */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <span className="material-icons text-orange-500 mr-2">rocket_launch</span>
                Deployment Status
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="font-medium">Cloudflare Workers</span>
                  </div>
                  <span className="text-sm text-green-700 bg-green-100 px-2 py-1 rounded">Active</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="font-medium">KV Storage</span>
                  </div>
                  <span className="text-sm text-green-700 bg-green-100 px-2 py-1 rounded">3 Namespaces</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="font-medium">R2 Storage</span>
                  </div>
                  <span className="text-sm text-green-700 bg-green-100 px-2 py-1 rounded">mcp-logs</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="font-medium">Dashboard</span>
                  </div>
                  <span className="text-sm text-blue-700 bg-blue-100 px-2 py-1 rounded">Running</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-4">
            <Button variant="outline">
              Reset to Defaults
            </Button>
            <Button onClick={handleSaveConfig} className="bg-blue-600 hover:bg-blue-700">
              <span className="material-icons text-lg mr-1">save</span>
              Save Configuration
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}