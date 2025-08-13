interface DashboardStatsProps {
  stats: {
    runningServers: number;
    stoppedServers: number;
    errorServers: number;
    edgeDevices: number;
  };
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const statCards = [
    {
      title: "Running Servers",
      value: stats.runningServers,
      icon: "play_circle_filled",
      bgColor: "bg-green-500/10",
      iconColor: "text-green-500",
      testId: "stat-running-servers"
    },
    {
      title: "Stopped Servers",
      value: stats.stoppedServers,
      icon: "pause_circle_filled",
      bgColor: "bg-gray-100",
      iconColor: "text-gray-600",
      testId: "stat-stopped-servers"
    },
    {
      title: "Error States",
      value: stats.errorServers,
      icon: "error",
      bgColor: "bg-red-500/10",
      iconColor: "text-red-500",
      testId: "stat-error-servers"
    },
    {
      title: "Edge Devices",
      value: stats.edgeDevices,
      icon: "device_hub",
      bgColor: "bg-blue-600/10",
      iconColor: "text-blue-600",
      testId: "stat-edge-devices"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {statCards.map((card) => (
        <div key={card.title} className="bg-white p-6 rounded-lg shadow" data-testid={card.testId}>
          <div className="flex items-center">
            <div className={`p-3 ${card.bgColor} rounded-full`}>
              <span className={`material-icons ${card.iconColor}`}>{card.icon}</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{card.title}</p>
              <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
