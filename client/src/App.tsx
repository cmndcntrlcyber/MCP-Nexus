import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import ServersPage from "@/pages/servers";
import MonitoringPage from "@/pages/monitoring";
import LogsPage from "@/pages/logs";
import DevicesPage from "@/pages/devices";
import ConfigPage from "@/pages/config";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/servers" component={ServersPage} />
      <Route path="/monitoring" component={MonitoringPage} />
      <Route path="/logs" component={LogsPage} />
      <Route path="/devices" component={DevicesPage} />
      <Route path="/config" component={ConfigPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
