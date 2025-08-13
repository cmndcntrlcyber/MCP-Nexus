import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, useEffect } from "react";
import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/sidebar";
import { useWebSocket, type WebSocketMessage } from "@/lib/websocket";
import type { Server, ServerLog } from "@shared/schema";

export default function LogsPage() {
  const [connectionStatus, setConnectionStatus] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string>('all');
  const [logs, setLogs] = useState<ServerLog[]>([]);

  const { data: servers = [] } = useQuery<Server[]>({
    queryKey: ['/api/servers'],
    refetchInterval: 30000,
  });

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'init':
        setConnectionStatus(true);
        break;
      case 'log_added':
        setLogs(prev => [...prev, message.data].slice(-1000)); // Keep last 1000 logs
        break;
    }
  }, []);

  useWebSocket(handleWebSocketMessage);

  // Load initial logs when server selection changes
  useEffect(() => {
    if (selectedServerId !== 'all') {
      // In a real implementation, you would fetch logs for the specific server
      // For demo purposes, we'll just filter existing logs
      setLogs(prev => prev.filter(log => log.serverId === selectedServerId));
    }
  }, [selectedServerId]);

  const filteredLogs = selectedServerId === 'all' ? logs : logs.filter(log => log.serverId === selectedServerId);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400 bg-red-900/20';
      case 'warn': return 'text-yellow-400 bg-yellow-900/20';
      case 'info': return 'text-green-400 bg-green-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  const getServerName = (serverId: string) => {
    const server = servers.find(s => s.id === serverId);
    return server?.name || serverId;
  };

  const formatTimestamp = (timestamp: Date | string | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader connectionStatus={connectionStatus} />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6">
          <div className="mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Server Logs</h1>
                <p className="text-gray-600">View real-time logs from all MCP servers</p>
              </div>
              <div className="flex items-center space-x-4">
                <select 
                  value={selectedServerId} 
                  onChange={(e) => setSelectedServerId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Servers</option>
                  {servers.map(server => (
                    <option key={server.id} value={server.id}>
                      {server.name}
                    </option>
                  ))}
                </select>
                <button 
                  onClick={() => setLogs([])}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Clear Logs
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Live Logs</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Live updating</span>
                </div>
              </div>
            </div>
            
            <div className="h-96 overflow-y-auto bg-gray-900 text-green-400 font-mono text-sm">
              {filteredLogs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <span className="material-icons text-4xl text-gray-600 mb-2">description</span>
                    <p>No logs available</p>
                    <p className="text-xs">Logs will appear here as servers generate them</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-1">
                  {filteredLogs.map((log, index) => (
                    <div key={`${log.id}-${index}`} className="flex items-start space-x-3">
                      <span className="text-gray-500 flex-shrink-0">
                        [{formatTimestamp(log.timestamp)}]
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs flex-shrink-0 ${getLevelColor(log.level)}`}>
                        {log.level.toUpperCase()}
                      </span>
                      {selectedServerId === 'all' && (
                        <span className="text-blue-400 flex-shrink-0">
                          {getServerName(log.serverId)}:
                        </span>
                      )}
                      <span className="flex-1">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Log Statistics</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Logs:</span>
                  <span className="font-medium">{logs.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Errors:</span>
                  <span className="font-medium text-red-500">
                    {logs.filter(l => l.level === 'error').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Warnings:</span>
                  <span className="font-medium text-yellow-500">
                    {logs.filter(l => l.level === 'warn').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Info:</span>
                  <span className="font-medium text-green-500">
                    {logs.filter(l => l.level === 'info').length}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Active Servers</h3>
              <div className="space-y-2">
                {servers.filter(s => s.status === 'running').map(server => (
                  <div key={server.id} className="flex items-center space-x-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>{server.name}</span>
                  </div>
                ))}
                {servers.filter(s => s.status === 'running').length === 0 && (
                  <div className="text-sm text-gray-500">No active servers</div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">Log Filters</h3>
              <div className="space-y-2">
                <button className="w-full text-left px-3 py-2 text-sm rounded bg-gray-50 hover:bg-gray-100 transition-colors">
                  Show only errors
                </button>
                <button className="w-full text-left px-3 py-2 text-sm rounded bg-gray-50 hover:bg-gray-100 transition-colors">
                  Show only warnings
                </button>
                <button className="w-full text-left px-3 py-2 text-sm rounded bg-gray-50 hover:bg-gray-100 transition-colors">
                  Export logs
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}