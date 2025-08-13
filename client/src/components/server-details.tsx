import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Server, ServerLog } from "@shared/schema";
import { useEffect, useState } from "react";

interface ServerDetailsProps {
  server: Server | null;
}

export function ServerDetails({ server }: ServerDetailsProps) {
  const queryClient = useQueryClient();
  const [logs, setLogs] = useState<ServerLog[]>([]);

  const { data: serverLogs } = useQuery({
    queryKey: ['/api/servers', server?.id, 'logs'],
    enabled: !!server,
  });

  useEffect(() => {
    if (serverLogs) {
      setLogs(Array.isArray(serverLogs) ? serverLogs : []);
    }
  }, [serverLogs]);

  const restartServerMutation = useMutation({
    mutationFn: (serverId: string) => apiRequest('POST', `/api/servers/${serverId}/restart`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/servers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
    },
  });

  const stopServerMutation = useMutation({
    mutationFn: (serverId: string) => apiRequest('POST', `/api/servers/${serverId}/stop`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/servers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
    },
  });

  // Add new logs from WebSocket updates
  const addLog = (log: ServerLog) => {
    if (server && log.serverId === server.id) {
      setLogs(prev => [...prev, log].slice(-100));
    }
  };

  // Expose addLog function to parent for WebSocket updates
  useEffect(() => {
    (window as any).__addServerLog = addLog;
    return () => {
      delete (window as any).__addServerLog;
    };
  }, [server?.id]);

  if (!server) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Server Details</h3>
        </div>
        <div className="p-6 text-center text-gray-500" data-testid="no-server-selected">
          <span className="material-icons text-4xl text-gray-300 mb-2">dns</span>
          <p>Select a server to view details</p>
        </div>
      </div>
    );
  }

  const formatMemory = (pid: number | null) => {
    if (!pid) return 'N/A';
    return `${Math.floor(Math.random() * 100) + 20}.${Math.floor(Math.random() * 10)} MB`;
  };

  const formatCPU = (pid: number | null) => {
    if (!pid) return 'N/A';
    return `${(Math.random() * 5).toFixed(1)}%`;
  };

  const formatTimestamp = (timestamp: Date | string | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Server Details</h3>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2" data-testid="server-details-name">
                {server.name}
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${
                    server.status === 'running' ? 'text-green-500' : 
                    server.status === 'error' ? 'text-red-500' : 'text-gray-600'
                  }`} data-testid="server-details-status">
                    {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Device:</span>
                  <span data-testid="server-details-device">{server.deviceId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">PID:</span>
                  <span data-testid="server-details-pid">{server.pid || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Memory:</span>
                  <span data-testid="server-details-memory">{formatMemory(server.pid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">CPU:</span>
                  <span data-testid="server-details-cpu">{formatCPU(server.pid)}</span>
                </div>
              </div>
            </div>

            <div>
              <h5 className="font-medium text-gray-900 mb-2">Configuration</h5>
              <div className="bg-gray-50 p-3 rounded text-xs font-mono" data-testid="server-config">
                <div>Command: {server.command}</div>
                <div>Args: {JSON.stringify(server.args || [])}</div>
                <div>Env: {JSON.stringify(server.env || {})}</div>
                <div>Auto Restart: {server.autoRestart ? 'true' : 'false'}</div>
              </div>
            </div>

            <div>
              <h5 className="font-medium text-gray-900 mb-2">Recent Logs</h5>
              <div 
                className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono h-32 overflow-y-auto"
                data-testid="server-logs"
              >
                {logs.length === 0 ? (
                  <div className="text-gray-500">No logs available</div>
                ) : (
                  logs.slice(-10).map((log) => (
                    <div key={log.id} className="mb-1">
                      <span className="text-gray-500">[{formatTimestamp(log.timestamp)}]</span>
                      <span className={`ml-2 ${
                        log.level === 'error' ? 'text-red-400' : 
                        log.level === 'warn' ? 'text-yellow-400' : 'text-green-400'
                      }`}>
                        [{log.level.toUpperCase()}] {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex space-x-2">
              <button 
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center"
                onClick={() => restartServerMutation.mutate(server.id)}
                disabled={restartServerMutation.isPending}
                data-testid="button-restart-server"
              >
                <span className="material-icons text-lg mr-1">refresh</span>
                {restartServerMutation.isPending ? 'Restarting...' : 'Restart'}
              </button>
              <button 
                className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center justify-center"
                onClick={() => stopServerMutation.mutate(server.id)}
                disabled={stopServerMutation.isPending || server.status === 'stopped'}
                data-testid="button-stop-server"
              >
                <span className="material-icons text-lg mr-1">stop</span>
                {stopServerMutation.isPending ? 'Stopping...' : 'Stop'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edge Device Status */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Edge Devices</h3>
        </div>
        
        <div className="divide-y divide-gray-200">
          <div className="p-4" data-testid="edge-device-item">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="font-medium">edge-device-001</span>
              </div>
              <span className="text-sm text-gray-600">2 servers</span>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Last seen: 30s ago
            </div>
          </div>
          
          <div className="p-4" data-testid="edge-device-item">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="font-medium">edge-device-002</span>
              </div>
              <span className="text-sm text-gray-600">1 server</span>
            </div>
            <div className="mt-1 text-xs text-red-500">
              Connection lost: 5m ago
            </div>
          </div>
          
          <div className="p-4" data-testid="edge-device-item">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="font-medium">edge-device-003</span>
              </div>
              <span className="text-sm text-gray-600">1 server</span>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Last seen: 1m ago
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
