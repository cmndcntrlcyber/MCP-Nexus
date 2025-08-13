# Overview

This is a full-stack MCP (Model Context Protocol) Server Manager application built with React frontend and Node.js backend, designed for Cloudflare deployment. The application provides a web-based dashboard for managing real MCP servers across distributed edge devices, featuring real-time monitoring, server lifecycle management, and centralized logging capabilities.

The system is designed to handle multiple MCP servers running on different edge devices via Cloudflare Tunnels, providing administrators with a unified interface to start, stop, restart, and monitor actual MCP server processes. It includes WebSocket-based real-time updates, comprehensive logging, Cloudflare branding, and a modern UI built with shadcn/ui components.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React SPA**: Single-page application built with React 18 using TypeScript
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Framework**: shadcn/ui components with Radix UI primitives and Tailwind CSS for styling
- **Routing**: Wouter for client-side routing with a simple, lightweight approach
- **Real-time Communication**: WebSocket client for live updates from the backend
- **Build System**: Vite for fast development and optimized production builds

## Backend Architecture
- **Express.js Server**: RESTful API server with middleware for JSON parsing and request logging
- **MCP Server Manager**: Real MCP server process management using child_process spawning
- **MCP SDK Integration**: Built with @modelcontextprotocol/sdk for proper MCP server communication
- **WebSocket Integration**: Real-time bidirectional communication using the 'ws' library
- **In-Memory Storage**: Development storage implementation with MCP server lifecycle management
- **API Design**: RESTful endpoints for CRUD operations on servers, devices, and logs
- **Development Integration**: Vite middleware integration for seamless development experience
- **Cloudflare Ready**: Worker deployment configuration and KV namespace integration prepared

## Data Storage Solutions
- **Database ORM**: Drizzle ORM configured for PostgreSQL with migration support
- **Schema Design**: Well-defined tables for servers, edge devices, and server logs with proper relationships
- **Connection**: Neon Database serverless PostgreSQL for cloud-based data persistence
- **Migration System**: Drizzle Kit for database schema migrations and version control

## Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL session store (connect-pg-simple)
- **Development Mode**: Currently operating without authentication for development purposes
- **Future Implementation**: Authentication system planned with user management capabilities

## External Dependencies
- **@modelcontextprotocol/sdk**: Official MCP SDK for server management and communication
- **Neon Database**: Serverless PostgreSQL database hosting (configured but using in-memory for development)
- **Cloudflare Workers**: Serverless compute platform for deployment with KV storage
- **Cloudflare KV**: Key-value storage for server state and configuration
- **Cloudflare R2**: Object storage for centralized logging
- **Cloudflare Tunnels**: Secure connectivity for edge devices
- **Shadcn/ui**: Component library for consistent UI design
- **Radix UI**: Headless UI primitives for accessible components
- **Material Icons**: Google Material Icons for consistent iconography
- **TanStack Query**: Advanced data synchronization and caching
- **WebSocket (ws)**: Real-time communication protocol implementation
- **Tailwind CSS**: Utility-first CSS framework for rapid styling
- **TypeScript**: Type safety across the entire application stack

The application follows a monorepo structure with shared schemas and types between frontend and backend, ensuring type safety and consistency across the full stack. The architecture is designed for scalability and real-time performance, making it suitable for managing distributed MCP server infrastructures.

## Cloudflare Deployment Configuration
- **Account ID**: 523d80131d8cba13f765b80d6bb9e096
- **KV Namespaces**: 
  - mcp_config: da1294711f1942749a6996bf3f35fe90
  - mcp_device_tokens: accf88bbd2b24eaba87de3722e4c1588
  - mcp_server_state: c59b2dff9bcb46978f3b552885d7bf8a
- **R2 Bucket**: mcp-logs
- **Worker Configuration**: Ready for deployment with wrangler.toml
- **Edge Device Support**: Cloudflare Tunnel integration for secure edge connectivity

## MCP Server Management
The system now includes proper MCP server lifecycle management:
- Real process spawning and monitoring using Node.js child_process
- Integration with @modelcontextprotocol/sdk for proper MCP communication
- Auto-restart capabilities with configurable retry limits
- Real-time log streaming and error handling
- Support for environment variables and command-line arguments
- Edge device connectivity through Cloudflare infrastructure

## Deployment Status
- ✅ Development environment fully functional
- ✅ Cloudflare Workers configuration ready
- ✅ KV namespace IDs configured
- ✅ R2 bucket configuration prepared
- ✅ Real MCP server management implemented
- 🔄 Ready for production deployment to Cloudflare Workers