import { useState } from 'react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Server } from "@shared/schema";

interface ServerListProps {
  servers: Server[];
  onServerSelect: (serverId: string) => void;
  selectedServerId?: string;
}

export function ServerList({ servers, onServerSelect, selectedServerId }: ServerListProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);

  const startServerMutation = useMutation({
    mutationFn: (serverId: string) => apiRequest('POST', `/api/servers/${serverId}/start`),
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

  const restartServerMutation = useMutation({
    mutationFn: (serverId: string) => apiRequest('POST', `/api/servers/${serverId}/restart`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/servers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
    },
  });

  const deleteServerMutation = useMutation({
    mutationFn: (serverId: string) => apiRequest('DELETE', `/api/servers/${serverId}`),
    onSuccess: (_, serverId) => {
      const server = servers.find(s => s.id === serverId);
      toast({
        title: "Server deleted",
        description: `${server?.name || 'Server'} has been deleted successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/servers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
    },
    onError: (error) => {
      toast({
        title: "Error deleting server",
        description: "Failed to delete the server. Please try again.",
        variant: "destructive",
      });
      console.error('Delete server error:', error);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'stopped': return 'bg-gray-400';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500';
      case 'stopped':
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600';
      case 'error':
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500';
      default:
        return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600';
    }
  };

  const formatUptime = (uptime: Date | string | null) => {
    if (!uptime) return null;
    
    const now = new Date();
    const uptimeDate = typeof uptime === 'string' ? new Date(uptime) : uptime;
    const diff = now.getTime() - uptimeDate.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">MCP Servers</h2>
        <div className="flex space-x-2">
          <button 
            className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/servers'] });
              queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
            }}
            data-testid="button-refresh"
          >
            <span className="material-icons text-lg">refresh</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {servers.length === 0 ? (
          <div className="p-8 text-center text-gray-500" data-testid="empty-servers">
            <span className="material-icons text-4xl text-gray-300 mb-2">dns</span>
            <p>No servers configured</p>
            <p className="text-sm">Add a server to get started</p>
          </div>
        ) : (
          servers.map((server) => (
            <div 
              key={server.id} 
              className={`p-6 hover:bg-gray-50 cursor-pointer transition-colors ${
                selectedServerId === server.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
              }`}
              onClick={() => onServerSelect(server.id)}
              data-testid={`server-item-${server.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-3 h-3 ${getStatusColor(server.status)} rounded-full`}></div>
                  <div>
                    <h3 className="font-medium text-gray-900" data-testid={`server-name-${server.id}`}>
                      {server.name}
                    </h3>
                    <p className="text-sm text-gray-600" data-testid={`server-id-${server.id}`}>
                      {server.id}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={getStatusBadge(server.status)} data-testid={`server-status-${server.id}`}>
                    {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
                  </span>
                  <div className="flex space-x-1">
                    <button 
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        startServerMutation.mutate(server.id);
                      }}
                      disabled={startServerMutation.isPending || server.status === 'running'}
                      data-testid={`button-start-${server.id}`}
                    >
                      <span className="material-icons text-lg">play_arrow</span>
                    </button>
                    <button 
                      className="p-1 text-gray-400 hover:text-orange-500 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        restartServerMutation.mutate(server.id);
                      }}
                      disabled={restartServerMutation.isPending}
                      data-testid={`button-restart-${server.id}`}
                    >
                      <span className="material-icons text-lg">refresh</span>
                    </button>
                    <button 
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        stopServerMutation.mutate(server.id);
                      }}
                      disabled={stopServerMutation.isPending || server.status === 'stopped'}
                      data-testid={`button-stop-${server.id}`}
                    >
                      <span className="material-icons text-lg">stop</span>
                    </button>
                    <Dialog open={deleteDialogOpen === server.id} onOpenChange={(open) => setDeleteDialogOpen(open ? server.id : null)}>
                      <DialogTrigger asChild>
                        <button 
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteDialogOpen(server.id);
                          }}
                          data-testid={`button-delete-${server.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete Server</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete "{server.name}"? This action cannot be undone.
                            The server will be stopped and all its data will be removed.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDeleteDialogOpen(null)}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              deleteServerMutation.mutate(server.id);
                              setDeleteDialogOpen(null);
                            }}
                            disabled={deleteServerMutation.isPending}
                            data-testid={`confirm-delete-${server.id}`}
                          >
                            {deleteServerMutation.isPending ? 'Deleting...' : 'Delete'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                <span data-testid={`server-command-${server.id}`}>
                  {server.command} {Array.isArray(server.args) ? server.args.join(' ') : ''}
                </span>
                <span>•</span>
                {server.status === 'running' && server.uptime ? (
                  <>
                    <span>Uptime: <span data-testid={`server-uptime-${server.id}`}>{formatUptime(server.uptime)}</span></span>
                    <span>•</span>
                  </>
                ) : server.lastError ? (
                  <>
                    <span className="text-red-500">Error: {server.lastError}</span>
                    <span>•</span>
                  </>
                ) : null}
                <span>Restarts: <span data-testid={`server-restarts-${server.id}`}>{server.restartCount}</span></span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
