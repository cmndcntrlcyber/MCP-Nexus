import { useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/sidebar";
import { useWebSocket, type WebSocketMessage } from "@/lib/websocket";
import type { Server } from "@shared/schema";

export default function MonitoringPage() {
  const [connectionStatus, setConnectionStatus] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);

  const { data: serversData } = useQuery({
    queryKey: ['/api/servers'],
    refetchInterval: 5000,
  });

  const { data: statsData } = useQuery({
    queryKey: ['/api/stats'],
    refetchInterval: 30000,
  });

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'init':
        setConnectionStatus(true);
        break;
      case 'server_updated':
        setServers(prev => prev.map(server => 
          server.id === message.data.id ? { ...server, ...message.data } : server
        ));
        break;
    }
  }, []);

  useWebSocket(handleWebSocketMessage);

  // Update servers when data changes
  if (serversData && Array.isArray(serversData)) {
    setServers(serversData);
  }

  const runningServers = servers.filter(s => s.status === 'running');

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader connectionStatus={connectionStatus} />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Real-time Monitoring</h1>
            <p className="text-gray-600">Monitor server performance and metrics</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">System Overview</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Total Servers:</span>
                  <span className="font-medium">{servers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Running:</span>
                  <span className="font-medium text-green-500">{runningServers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Stopped:</span>
                  <span className="font-medium text-gray-500">
                    {servers.filter(s => s.status === 'stopped').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Errors:</span>
                  <span className="font-medium text-red-500">
                    {servers.filter(s => s.status === 'error').length}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Resource Usage</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>CPU Usage</span>
                    <span className="text-sm">12.5%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{width: '12.5%'}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Memory Usage</span>
                    <span className="text-sm">248 MB</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{width: '31%'}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Network I/O</span>
                    <span className="text-sm">1.2 MB/s</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-yellow-500 h-2 rounded-full" style={{width: '8%'}}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Running Servers</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {runningServers.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <span className="material-icons text-4xl text-gray-300 mb-2">dns</span>
                  <p>No servers are currently running</p>
                </div>
              ) : (
                runningServers.map((server) => (
                  <div key={server.id} className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{server.name}</h4>
                        <p className="text-sm text-gray-600">{server.command}</p>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-gray-600">
                          PID: {server.pid || 'N/A'}
                        </div>
                        <div className="text-gray-600">
                          Uptime: {server.uptime ? 
                            Math.floor((new Date().getTime() - new Date(server.uptime).getTime()) / (1000 * 60)) + 'm' : 
                            'N/A'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}