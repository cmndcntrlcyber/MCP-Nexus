import { useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/sidebar";
import { DashboardStats } from "@/components/dashboard-stats";
import { ServerList } from "@/components/server-list";
import { ServerDetails } from "@/components/server-details";
import { AddServerModal } from "@/components/add-server-modal";
import { Button } from "@/components/ui/button";
import { useWebSocket, type WebSocketMessage } from "@/lib/websocket";
import type { Server } from "@shared/schema";

export default function Dashboard() {
  const [selectedServerId, setSelectedServerId] = useState<string>();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);

  const { data: statsData } = useQuery({
    queryKey: ['/api/stats'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: serversData } = useQuery({
    queryKey: ['/api/servers'],
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    console.log('WebSocket message:', message);
    
    switch (message.type) {
      case 'init':
        setConnectionStatus(true);
        break;
      case 'server_updated':
        setServers(prev => prev.map(server => 
          server.id === message.data.id ? { ...server, ...message.data } : server
        ));
        break;
      case 'server_created':
        setServers(prev => [...prev, message.data]);
        break;
      case 'server_deleted':
        setServers(prev => prev.filter(server => server.id !== message.data.id));
        if (selectedServerId === message.data.id) {
          setSelectedServerId(undefined);
        }
        break;
      case 'log_added':
        // Pass log to server details component
        if ((window as any).__addServerLog) {
          (window as any).__addServerLog(message.data);
        }
        break;
    }
  }, [selectedServerId]);

  useWebSocket(handleWebSocketMessage);

  // Update servers when data changes
  if (serversData && JSON.stringify(serversData) !== JSON.stringify(servers)) {
    setServers(serversData);
  }

  const selectedServer = servers.find(s => s.id === selectedServerId) || null;

  const stats = statsData || {
    runningServers: 0,
    stoppedServers: 0,
    errorServers: 0,
    edgeDevices: 0,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader connectionStatus={connectionStatus} />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6">
          <DashboardStats stats={stats} />
          
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Server Management</h2>
                <Button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-add-server"
                >
                  <span className="material-icons text-lg mr-1">add</span>
                  Add Server
                </Button>
              </div>
              
              <ServerList 
                servers={servers}
                onServerSelect={setSelectedServerId}
                selectedServerId={selectedServerId}
              />
            </div>
            
            <div className="xl:col-span-1">
              <ServerDetails server={selectedServer} />
            </div>
          </div>
        </main>
      </div>

      <AddServerModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}
