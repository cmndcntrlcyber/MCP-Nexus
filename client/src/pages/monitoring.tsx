import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, useEffect } from "react";
import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/sidebar";
import { useWebSocket, type WebSocketMessage } from "@/lib/websocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Activity, Cpu, HardDrive, Network, AlertCircle, CheckCircle, Clock, Database } from "lucide-react";
import type { Server, ServerLog } from "@shared/schema";

interface MetricsData {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  timestamp: string;
}

interface ServerMetrics {
  serverId: string;
  cpu: number;
  memory: number;
  requestsPerSecond: number;
  avgResponseTime: number;
  errorRate: number;
  uptime: number;
}

export default function MonitoringPage() {
  const [connectionStatus, setConnectionStatus] = useState(false);
  const [metricsHistory, setMetricsHistory] = useState<MetricsData[]>([]);
  const [serverMetrics, setServerMetrics] = useState<Record<string, ServerMetrics>>({});
  const [recentLogs, setRecentLogs] = useState<ServerLog[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);

  const { data: serversData } = useQuery<Server[]>({
    queryKey: ['/api/servers'],
    refetchInterval: 5000,
  });

  const { data: statsData } = useQuery({
    queryKey: ['/api/stats'],
    refetchInterval: 30000,
  });

  const { data: systemMetrics } = useQuery<MetricsData>({
    queryKey: ['/api/monitoring/metrics'],
    refetchInterval: 2000,
  });

  const { data: serverPerformance } = useQuery<ServerMetrics[]>({
    queryKey: ['/api/monitoring/servers'],
    refetchInterval: 5000,
  });

  const { data: alertsData } = useQuery({
    queryKey: ['/api/monitoring/alerts'],
    refetchInterval: 10000,
  });

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'init':
        setConnectionStatus(true);
        break;
      case 'metrics_update':
        setMetricsHistory(prev => {
          const newHistory = [...prev, message.data];
          return newHistory.slice(-30); // Keep last 30 data points
        });
        break;
      case 'server_metrics':
        setServerMetrics(prev => ({
          ...prev,
          [message.data.serverId]: message.data
        }));
        break;
      case 'log_added':
        setRecentLogs(prev => {
          const newLogs = [message.data, ...prev];
          return newLogs.slice(0, 100); // Keep last 100 logs
        });
        break;
    }
  }, []);

  useWebSocket(handleWebSocketMessage);

  // Update metrics history when system metrics change
  useEffect(() => {
    if (systemMetrics) {
      setMetricsHistory(prev => {
        const newHistory = [...prev, { ...systemMetrics, timestamp: new Date().toISOString() }];
        return newHistory.slice(-30);
      });
    }
  }, [systemMetrics]);

  // Update server metrics when performance data changes
  useEffect(() => {
    if (serverPerformance) {
      const metricsMap: Record<string, ServerMetrics> = {};
      serverPerformance.forEach(metric => {
        metricsMap[metric.serverId] = metric;
      });
      setServerMetrics(metricsMap);
    }
  }, [serverPerformance]);

  const servers = serversData || [];
  const runningServers = servers.filter(s => s.status === 'running');

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-500';
      case 'stopped': return 'text-gray-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'info': return 'text-blue-500';
      case 'warn': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader connectionStatus={connectionStatus} />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Real-time Monitoring</h1>
            <p className="text-gray-600">Monitor server performance, metrics, and system health</p>
          </div>

          {/* System Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemMetrics?.cpu || 0}%</div>
                <Progress value={systemMetrics?.cpu || 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemMetrics?.memory || 0}%</div>
                <Progress value={systemMetrics?.memory || 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemMetrics?.disk || 0}%</div>
                <Progress value={systemMetrics?.disk || 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Network I/O</CardTitle>
                <Network className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatBytes(systemMetrics?.network || 0)}/s</div>
                <div className="text-xs text-muted-foreground">Throughput</div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="servers">Server Details</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* System Metrics Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>System Metrics Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={metricsHistory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                        />
                        <YAxis />
                        <Tooltip 
                          labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="cpu" stroke="#3b82f6" name="CPU %" />
                        <Line type="monotone" dataKey="memory" stroke="#10b981" name="Memory %" />
                        <Line type="monotone" dataKey="disk" stroke="#f59e0b" name="Disk %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Server Status Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Server Status Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Running</span>
                        </div>
                        <span className="font-bold">{runningServers.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span>Stopped</span>
                        </div>
                        <span className="font-bold">
                          {servers.filter(s => s.status === 'stopped').length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <span>Error</span>
                        </div>
                        <span className="font-bold">
                          {servers.filter(s => s.status === 'error').length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Server Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {runningServers.map(server => {
                      const metrics = serverMetrics[server.id];
                      return (
                        <div key={server.id} className="space-y-2 p-4 border rounded-lg">
                          <h4 className="font-semibold">{server.name}</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-600">CPU:</span>
                              <span className="ml-2 font-medium">{metrics?.cpu || 0}%</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Memory:</span>
                              <span className="ml-2 font-medium">{metrics?.memory || 0} MB</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Requests/s:</span>
                              <span className="ml-2 font-medium">{metrics?.requestsPerSecond || 0}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Avg Response:</span>
                              <span className="ml-2 font-medium">{metrics?.avgResponseTime || 0}ms</span>
                            </div>
                          </div>
                          <Progress value={metrics?.cpu || 0} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="servers" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Server Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {servers.map(server => (
                      <div key={server.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{server.name}</h4>
                          <Badge className={getStatusColor(server.status)}>
                            {server.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Command:</span>
                            <div className="font-medium">{server.command}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">PID:</span>
                            <div className="font-medium">{server.pid || 'N/A'}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Restarts:</span>
                            <div className="font-medium">{server.restartCount}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Uptime:</span>
                            <div className="font-medium">
                              {server.uptime ? 
                                Math.floor((new Date().getTime() - new Date(server.uptime).getTime()) / (1000 * 60)) + 'm' : 
                                'N/A'
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logs" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Logs</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {recentLogs.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                          No logs available
                        </div>
                      ) : (
                        recentLogs.map(log => (
                          <div key={log.id} className="text-sm font-mono p-2 bg-gray-50 rounded">
                            <span className="text-gray-500">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={`ml-2 ${getLogLevelColor(log.level)}`}>
                              [{log.level.toUpperCase()}]
                            </span>
                            <span className="ml-2">{log.message}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="alerts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Active Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {!alertsData || (alertsData as any[])?.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                        <p>No active alerts - all systems operational</p>
                      </div>
                    ) : (
                      (alertsData as any[])?.map((alert: any) => (
                        <div key={alert.id} className="p-4 border rounded-lg border-red-200 bg-red-50">
                          <div className="flex items-start space-x-2">
                            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                            <div className="flex-1">
                              <h5 className="font-semibold text-red-900">{alert.title}</h5>
                              <p className="text-sm text-red-700">{alert.message}</p>
                              <p className="text-xs text-red-600 mt-1">
                                {new Date(alert.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}