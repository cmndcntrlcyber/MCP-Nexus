import { useState, useCallback, useEffect } from "react";
import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWebSocket, type WebSocketMessage } from "@/lib/websocket";
import { useToast } from "@/hooks/use-toast";

const CONFIG_STORAGE_KEY = 'mcp-server-config';

const defaultConfig = {
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
};

export default function ConfigPage() {
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [certificateStatus, setCertificateStatus] = useState<{edge?: string; client?: string}>({});
  const [certificates, setCertificates] = useState<{edge?: File; client?: File}>({});
  const [deploymentResult, setDeploymentResult] = useState<{success: boolean; message: string; endpoint?: string} | null>(null);
  
  // Load config from localStorage on mount, then sync with backend
  const [config, setConfig] = useState(() => {
    const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (savedConfig) {
      try {
        return JSON.parse(savedConfig);
      } catch (error) {
        console.error('Failed to parse saved config:', error);
        return defaultConfig;
      }
    }
    return defaultConfig;
  });

  // Sync with backend on mount
  useEffect(() => {
    const loadBackendConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const backendConfig = await response.json();
          // Merge backend config with local config (backend takes precedence)
          setConfig(backendConfig);
          localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(backendConfig));
        }
      } catch (error) {
        console.error('Failed to load config from backend:', error);
        // Keep using local config if backend fails
      }
    };

    loadBackendConfig();
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'init':
        setConnectionStatus(true);
        break;
    }
  }, []);

  useWebSocket(handleWebSocketMessage);

  // Auto-save config to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage immediately
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
      
      // Also save to backend
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        toast({
          title: "Configuration Saved",
          description: "Your configuration has been saved successfully.",
        });
      } else {
        throw new Error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      // Even if backend save fails, localStorage is already updated
      toast({
        title: "Configuration Saved Locally",
        description: "Configuration saved to browser storage. Backend sync may have failed.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetConfig = () => {
    if (confirm('Are you sure you want to reset to default configuration?')) {
      setConfig(defaultConfig);
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(defaultConfig));
      toast({
        title: "Configuration Reset",
        description: "Configuration has been reset to defaults.",
      });
    }
  };

  const handleCertificateUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'edge' | 'client') => {
    const file = e.target.files?.[0];
    if (file) {
      setCertificates(prev => ({ ...prev, [type]: file }));
      setCertificateStatus(prev => ({ ...prev, [type]: 'success' }));
      toast({
        title: `${type === 'edge' ? 'Edge' : 'Client'} Certificate Loaded`,
        description: `${file.name} has been loaded successfully.`,
      });
    }
  };

  const handleClearCertificates = () => {
    setCertificates({});
    setCertificateStatus({});
    setDeploymentResult(null);
    // Clear file inputs
    const edgeInput = document.getElementById('edgeCert') as HTMLInputElement;
    const clientInput = document.getElementById('clientCert') as HTMLInputElement;
    if (edgeInput) edgeInput.value = '';
    if (clientInput) clientInput.value = '';
    
    toast({
      title: "Certificates Cleared",
      description: "All certificates have been removed.",
    });
  };

  const handleDeployCertificates = async () => {
    if (!config.orgSlug) {
      toast({
        title: "Missing Organization Slug",
        description: "Please enter an organization slug before deploying.",
        variant: "destructive",
      });
      return;
    }

    setIsDeploying(true);
    setDeploymentResult(null);

    try {
      const formData = new FormData();
      formData.append('orgSlug', config.orgSlug);
      formData.append('tunnelDomain', config.tunnelDomain || 'c3s.nexus');
      
      if (certificates.edge) {
        formData.append('edgeCertificate', certificates.edge);
      }
      if (certificates.client) {
        formData.append('clientCertificate', certificates.client);
      }

      const response = await fetch('/api/certificates/deploy', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        const endpoint = `${config.orgSlug}.${config.tunnelDomain || 'c3s.nexus'}`;
        setDeploymentResult({
          success: true,
          message: 'Certificates deployed successfully!',
          endpoint: endpoint,
        });
        toast({
          title: "Deployment Successful",
          description: `Certificates deployed to ${endpoint}`,
        });
      } else {
        throw new Error(result.error || 'Deployment failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to deploy certificates';
      setDeploymentResult({
        success: false,
        message: errorMessage,
      });
      toast({
        title: "Deployment Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
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

            {/* Certificate Management */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <span className="material-icons text-red-500 mr-2">security</span>
                Certificate Management
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="orgSlug">Organization Slug</Label>
                    <Input
                      id="orgSlug"
                      placeholder="Enter organization slug"
                      value={config.orgSlug || ''}
                      onChange={(e) => setConfig({...config, orgSlug: e.target.value})}
                    />
                    <p className="text-xs text-gray-500 mt-1">Used as: {config.orgSlug || '$slug'}.{config.tunnelDomain || 'domain'}</p>
                  </div>
                  <div>
                    <Label htmlFor="tunnelDomain">Tunnel Domain</Label>
                    <select
                      id="tunnelDomain"
                      value={config.tunnelDomain || 'c3s.nexus'}
                      onChange={(e) => setConfig({...config, tunnelDomain: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="c3s.nexus">c3s.nexus</option>
                      <option value="d3fend.nexus">d3fend.nexus</option>
                      <option value="attck.nexus">attck.nexus</option>
                    </select>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edgeCert">Edge Certificate</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          id="edgeCert"
                          type="file"
                          accept=".pem,.crt,.cer"
                          onChange={(e) => handleCertificateUpload(e, 'edge')}
                          className="flex-1"
                        />
                        {certificateStatus.edge && (
                          <span className={`text-sm ${certificateStatus.edge === 'success' ? 'text-green-600' : 'text-gray-500'}`}>
                            {certificateStatus.edge === 'success' ? '✓' : '○'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Upload edge device certificate (.pem, .crt, .cer)</p>
                    </div>
                    <div>
                      <Label htmlFor="clientCert">Client Certificate</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          id="clientCert"
                          type="file"
                          accept=".pem,.crt,.cer"
                          onChange={(e) => handleCertificateUpload(e, 'client')}
                          className="flex-1"
                        />
                        {certificateStatus.client && (
                          <span className={`text-sm ${certificateStatus.client === 'success' ? 'text-green-600' : 'text-gray-500'}`}>
                            {certificateStatus.client === 'success' ? '✓' : '○'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Upload client authentication certificate (.pem, .crt, .cer)</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleClearCertificates}
                    disabled={!certificateStatus.edge && !certificateStatus.client}
                  >
                    Clear Certificates
                  </Button>
                  <Button
                    onClick={handleDeployCertificates}
                    disabled={!config.orgSlug || (!certificateStatus.edge && !certificateStatus.client) || isDeploying}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <span className="material-icons text-lg mr-1">send</span>
                    {isDeploying ? 'Deploying...' : 'Deploy to Tunnel'}
                  </Button>
                </div>

                {deploymentResult && (
                  <div className={`p-3 rounded-lg ${deploymentResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    <p className="text-sm font-medium">{deploymentResult.message}</p>
                    {deploymentResult.endpoint && (
                      <p className="text-xs mt-1">Endpoint: {deploymentResult.endpoint}</p>
                    )}
                  </div>
                )}
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
            <Button 
              variant="outline" 
              onClick={handleResetConfig}
            >
              Reset to Defaults
            </Button>
            <Button 
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <span className="material-icons text-lg mr-1">save</span>
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}