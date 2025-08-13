import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/sidebar";
import { useWebSocket, type WebSocketMessage } from "@/lib/websocket";
import type { EdgeDevice, Server } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function DevicesPage() {
  const [connectionStatus, setConnectionStatus] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<EdgeDevice | null>(null);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceId, setNewDeviceId] = useState("");
  const { toast } = useToast();

  const { data: devices = [] } = useQuery<EdgeDevice[]>({
    queryKey: ['/api/devices'],
    refetchInterval: 30000,
  });

  const { data: servers = [] } = useQuery<Server[]>({
    queryKey: ['/api/servers'],
    refetchInterval: 30000,
  });

  // Add device mutation
  const addDeviceMutation = useMutation({
    mutationFn: async (data: { id: string; name: string }) => {
      return apiRequest('/api/devices', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      setShowAddDialog(false);
      setNewDeviceName("");
      setNewDeviceId("");
      toast({
        title: "Device Added",
        description: "Edge device has been successfully registered.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add device",
        description: error?.message || "An error occurred while adding the device.",
        variant: "destructive",
      });
    },
  });

  // Delete device mutation
  const deleteDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      return apiRequest(`/api/devices/${deviceId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      setShowDeleteDialog(false);
      setSelectedDevice(null);
      toast({
        title: "Device Removed",
        description: "Edge device has been successfully removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove device",
        description: error?.error || error?.message || "An error occurred while removing the device.",
        variant: "destructive",
      });
    },
  });

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'init':
        setConnectionStatus(true);
        break;
      case 'device_created':
      case 'device_updated':
      case 'device_deleted':
        queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
        break;
    }
  }, []);

  useWebSocket(handleWebSocketMessage);

  const handleAddDevice = () => {
    if (!newDeviceName.trim() || !newDeviceId.trim()) {
      toast({
        title: "Invalid input",
        description: "Please provide both device ID and name.",
        variant: "destructive",
      });
      return;
    }

    addDeviceMutation.mutate({
      id: newDeviceId.trim(),
      name: newDeviceName.trim(),
    });
  };

  const handleDeleteDevice = (device: EdgeDevice) => {
    setSelectedDevice(device);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (selectedDevice) {
      deleteDeviceMutation.mutate(selectedDevice.id);
    }
  };

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
          <div className="mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Edge Devices</h1>
              <p className="text-gray-600">Monitor and manage your edge computing devices</p>
            </div>
            <Button 
              onClick={() => setShowAddDialog(true)}
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="button-add-device"
            >
              <span className="material-icons text-sm mr-2">add</span>
              Add Device
            </Button>
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
                    <span className="text-sm text-gray-600">
                      {device.metadata?.type === 'cloudflare-tunnel' && (
                        <span className="inline-flex items-center text-blue-600">
                          <span className="material-icons text-sm mr-1">cloud</span>
                          Cloudflare Tunnel
                        </span>
                      )}
                    </span>
                    <div className="flex space-x-2">
                      <button 
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        data-testid={`button-settings-${device.id}`}
                      >
                        <span className="material-icons text-lg">settings</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteDevice(device)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        data-testid={`button-delete-${device.id}`}
                      >
                        <span className="material-icons text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Cloudflare Tunnel Auto-Detection</h3>
            </div>
            <div className="p-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <span className="material-icons text-blue-600 mr-3">info</span>
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-2">Automatic Device Registration</h4>
                    <p className="text-sm text-blue-800">
                      Devices connecting through Cloudflare Tunnels are automatically detected and registered. 
                      When a new tunnel connection is established, the device will appear in this list with:
                    </p>
                    <ul className="list-disc list-inside text-sm text-blue-800 mt-2">
                      <li>Tunnel ID as the device identifier</li>
                      <li>Auto-generated name based on tunnel information</li>
                      <li>Connection metadata including region and IP</li>
                      <li>Real-time status updates</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Add Device Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Edge Device</DialogTitle>
            <DialogDescription>
              Manually register a new edge device. For Cloudflare Tunnel devices, automatic registration is recommended.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="device-id">Device ID</Label>
              <Input
                id="device-id"
                value={newDeviceId}
                onChange={(e) => setNewDeviceId(e.target.value)}
                placeholder="e.g., edge-device-001"
                data-testid="input-device-id"
              />
            </div>
            <div>
              <Label htmlFor="device-name">Device Name</Label>
              <Input
                id="device-name"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder="e.g., Production Server EU-West"
                data-testid="input-device-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddDevice}
              disabled={addDeviceMutation.isPending}
              data-testid="button-confirm-add"
            >
              {addDeviceMutation.isPending ? "Adding..." : "Add Device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Edge Device?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{selectedDevice?.name}"? 
              {selectedDevice && getDeviceServerCount(selectedDevice.id) > 0 && (
                <span className="block mt-2 text-red-600">
                  This device has {getDeviceServerCount(selectedDevice.id)} active server(s). 
                  Please stop or reassign them first.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deleteDeviceMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteDeviceMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}