import { Link, useLocation } from "wouter";

export function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", icon: "dashboard", label: "Dashboard" },
    { path: "/servers", icon: "dns", label: "Servers" },
    { path: "/monitoring", icon: "timeline", label: "Monitoring" },
    { path: "/logs", icon: "description", label: "Logs" },
    { path: "/devices", icon: "cloud", label: "Edge Devices" },
    { path: "/config", icon: "settings", label: "Configuration" },
  ];

  return (
    <aside className="w-64 bg-white shadow-lg h-screen relative">
      <nav className="p-4 space-y-2">
        {navItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <div className={`flex items-center space-x-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
              location === item.path
                ? 'bg-blue-600/10 text-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`} data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}>
              <span className="material-icons">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          </Link>
        ))}
      </nav>
      
      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center space-x-2 text-sm">
            <span className="material-icons text-blue-500 text-lg">cloud</span>
            <span className="font-medium text-blue-700">Cloudflare</span>
          </div>
          <div className="mt-1 text-xs text-blue-600">
            <div>Workers: Active</div>
            <div>KV: 3 Namespaces</div>
            <div>R2: mcp-logs</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
