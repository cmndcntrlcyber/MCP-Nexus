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
      return apiRequest('POST', '/api/devices', data);
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
      return apiRequest('DELETE', `/api/devices/${deviceId}`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/servers'] });
      setShowDeleteDialog(false);
      setSelectedDevice(null);
      
      const serversRemoved = data?.serversRemoved || 0;
      toast({
        title: "Device Removed",
        description: serversRemoved > 0 
          ? `Edge device and ${serversRemoved} server(s) have been successfully removed.`
          : "Edge device has been successfully removed.",
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
      case 'blocked': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  // Block/unblock mutations
  const blockDeviceMutation = useMutation({
    mutationFn: async ({ deviceId, reason }: { deviceId: string; reason: string }) => {
      return apiRequest('POST', `/api/devices/${deviceId}/block`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      toast({
        title: "Device Blocked",
        description: "Edge device has been blocked successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to block device",
        description: error?.message || "An error occurred while blocking the device.",
        variant: "destructive",
      });
    },
  });

  const unblockDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      return apiRequest('POST', `/api/devices/${deviceId}/unblock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      toast({
        title: "Device Unblocked",
        description: "Edge device has been unblocked successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to unblock device",
        description: error?.message || "An error occurred while unblocking the device.",
        variant: "destructive",
      });
    },
  });

  const handleBlockDevice = (device: EdgeDevice) => {
    const reason = prompt('Enter reason for blocking this device:');
    if (reason) {
      blockDeviceMutation.mutate({ deviceId: device.id, reason });
    }
  };

  const handleUnblockDevice = (device: EdgeDevice) => {
    unblockDeviceMutation.mutate(device.id);
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
                    device.status === 'online' ? 'bg-green-100 text-green-800' : 
                    device.status === 'blocked' ? 'bg-yellow-100 text-yellow-800' : 
                    'bg-red-100 text-red-800'
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
                  {device.certificateFingerprint && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Certificate:</span>
                      <span className="text-xs">
                        <span className="material-icons text-green-500 text-xs">verified_user</span>
                      </span>
                    </div>
                  )}
                  {device.blocked && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Blocked:</span>
                      <span className="text-xs text-yellow-600">{device.blockedReason || 'Yes'}</span>
                    </div>
                  )}
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
                      {device.blocked ? (
                        <button 
                          onClick={() => handleUnblockDevice(device)}
                          className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                          title="Unblock device"
                          data-testid={`button-unblock-${device.id}`}
                        >
                          <span className="material-icons text-base">lock_open</span>
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleBlockDevice(device)}
                          className="p-1 text-gray-400 hover:text-yellow-600 transition-colors"
                          title="Block device"
                          data-testid={`button-block-${device.id}`}
                        >
                          <span className="material-icons text-base">block</span>
                        </button>
                      )}
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
                    <h4 className="font-semibold text-blue-900 mb-2">Automatic Device Registration & Security</h4>
                    <p className="text-sm text-blue-800">
                      Devices connecting through Cloudflare Tunnels are automatically detected and registered. 
                      Each device can be secured with client certificate validation:
                    </p>
                    <ul className="list-disc list-inside text-sm text-blue-800 mt-2">
                      <li><span className="material-icons text-green-500" style={{ fontSize: '14px', verticalAlign: 'middle' }}>verified_user</span> Certificate validation for secure authentication</li>
                      <li><span className="material-icons text-yellow-600" style={{ fontSize: '14px', verticalAlign: 'middle' }}>block</span> Block/unblock devices to control access</li>
                      <li>Auto-generated name based on tunnel information</li>
                      <li>Connection metadata including region and IP</li>
                      <li>Real-time status updates and monitoring</li>
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
                <span className="block mt-2 text-yellow-600 font-semibold">
                  ⚠️ Warning: This device has {getDeviceServerCount(selectedDevice.id)} active server(s) that will be stopped and removed.
                </span>
              )}
              <span className="block mt-2 text-gray-600">
                This action cannot be undone.
              </span>
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