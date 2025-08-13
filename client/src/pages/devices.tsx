import { useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/sidebar";
import { useWebSocket, type WebSocketMessage } from "@/lib/websocket";
import type { EdgeDevice, Server } from "@shared/schema";

export default function DevicesPage() {
  const [connectionStatus, setConnectionStatus] = useState(false);

  const { data: devices = [] } = useQuery<EdgeDevice[]>({
    queryKey: ['/api/devices'],
    refetchInterval: 30000,
  });

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
    }
  }, []);

  useWebSocket(handleWebSocketMessage);

  const getDeviceServerCount = (deviceId: string) => {
    return servers.filter(s => s.deviceId === deviceId).length;
  };

  const getDeviceStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const formatLastSeen = (lastSeen: Date | null) => {
    if (!lastSeen) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - new Date(lastSeen).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader connectionStatus={connectionStatus} />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Edge Devices</h1>
            <p className="text-gray-600">Monitor and manage your edge computing devices</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {devices.map((device) => (
              <div key={device.id} className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 ${getDeviceStatusColor(device.status)} rounded-full`}></div>
                    <h3 className="font-semibold text-gray-900">{device.name}</h3>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    device.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {device.status}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Device ID:</span>
                    <span className="font-mono text-xs">{device.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Servers:</span>
                    <span className="font-medium">{getDeviceServerCount(device.id)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Seen:</span>
                    <span className={device.status === 'online' ? 'text-green-600' : 'text-red-600'}>
                      {formatLastSeen(device.lastSeen)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Actions:</span>
                    <div className="flex space-x-2">
                      <button className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                        <span className="material-icons text-lg">settings</span>
                      </button>
                      <button className="p-1 text-gray-400 hover:text-green-600 transition-colors">
                        <span className="material-icons text-lg">refresh</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Device Performance</h3>
            </div>
            <div className="p-6">
              <div className="text-center text-gray-500">
                <span className="material-icons text-4xl text-gray-300 mb-2">analytics</span>
                <p>Performance metrics will be displayed here</p>
                <p className="text-sm">Connect edge devices to see real-time data</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}