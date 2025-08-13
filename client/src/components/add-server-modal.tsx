import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { EdgeDevice } from "@shared/schema";

interface AddServerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddServerModal({ isOpen, onClose }: AddServerModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    command: '',
    args: '',
    deviceId: '',
    autoRestart: true,
  });

  const { data: devices = [] } = useQuery<EdgeDevice[]>({
    queryKey: ['/api/devices'],
    enabled: isOpen,
  });

  const addServerMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/servers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/servers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      onClose();
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      command: '',
      args: '',
      deviceId: '',
      autoRestart: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.command || !formData.deviceId) {
      return;
    }

    const serverData = {
      name: formData.name,
      command: formData.command,
      args: formData.args ? formData.args.split(' ').filter(arg => arg.length > 0) : [],
      deviceId: formData.deviceId,
      autoRestart: formData.autoRestart,
      maxRestarts: 3,
      status: 'stopped',
      restartCount: 0,
      env: {},
    };

    addServerMutation.mutate(serverData);
  };

  const handleClose = () => {
    if (!addServerMutation.isPending) {
      onClose();
      resetForm();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" data-testid="add-server-modal">
        <DialogHeader>
          <DialogTitle>Add MCP Server</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Server Name
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="e.g., my-filesystem-server"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              data-testid="input-server-name"
            />
          </div>
          
          <div>
            <Label htmlFor="command" className="block text-sm font-medium text-gray-700 mb-1">
              Command
            </Label>
            <Input
              id="command"
              type="text"
              placeholder="npx @modelcontextprotocol/server-filesystem"
              value={formData.command}
              onChange={(e) => setFormData({ ...formData, command: e.target.value })}
              required
              data-testid="input-server-command"
            />
          </div>
          
          <div>
            <Label htmlFor="args" className="block text-sm font-medium text-gray-700 mb-1">
              Arguments
            </Label>
            <Input
              id="args"
              type="text"
              placeholder="/data"
              value={formData.args}
              onChange={(e) => setFormData({ ...formData, args: e.target.value })}
              data-testid="input-server-args"
            />
          </div>
          
          <div>
            <Label htmlFor="deviceId" className="block text-sm font-medium text-gray-700 mb-1">
              Edge Device
            </Label>
            <Select value={formData.deviceId} onValueChange={(value) => setFormData({ ...formData, deviceId: value })}>
              <SelectTrigger data-testid="select-device">
                <SelectValue placeholder="Select an edge device" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.name} ({device.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="autoRestart"
              checked={formData.autoRestart}
              onCheckedChange={(checked) => setFormData({ ...formData, autoRestart: !!checked })}
              data-testid="checkbox-auto-restart"
            />
            <Label htmlFor="autoRestart" className="text-sm text-gray-700">
              Auto-restart on failure
            </Label>
          </div>
        </form>
        
        <DialogFooter className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={addServerMutation.isPending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={addServerMutation.isPending || !formData.name || !formData.command || !formData.deviceId}
            data-testid="button-add-server"
          >
            {addServerMutation.isPending ? 'Adding...' : 'Add Server'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
