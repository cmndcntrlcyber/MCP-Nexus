import { useState } from "react";

interface AppHeaderProps {
  connectionStatus: boolean;
}

export function AppHeader({ connectionStatus }: AppHeaderProps) {
  return (
    <header className="bg-white shadow-md border-b border-gray-200">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="material-icons text-blue-600 text-2xl">dns</span>
            <h1 className="text-xl font-medium text-gray-900">MCP Server Manager</h1>
          </div>
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
            connectionStatus 
              ? 'bg-green-50 text-green-700' 
              : 'bg-yellow-50 text-yellow-700'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
            }`}></div>
            <span data-testid="connection-status">
              {connectionStatus ? 'Connected' : 'Reconnecting...'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">
            <span>Account: </span>
            <code className="bg-gray-100 px-2 py-1 rounded text-xs">
              523d80131d8cba13f765b80d6bb9e096
            </code>
          </div>
          
          <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors" data-testid="button-user-menu">
            <span className="material-icons">account_circle</span>
            <span>Admin</span>
          </button>
          
          <button className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors" data-testid="button-settings">
            <span className="material-icons">settings</span>
          </button>
        </div>
      </div>
    </header>
  );
}
