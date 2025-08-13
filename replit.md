# Overview

This is a full-stack MCP (Model Context Protocol) Server Manager application built with React and Express.js. The application provides a web-based dashboard for managing MCP servers across distributed edge devices, featuring real-time monitoring, server lifecycle management, and centralized logging capabilities.

The system is designed to handle multiple MCP servers running on different edge devices, providing administrators with a unified interface to start, stop, restart, and monitor server instances. It includes WebSocket-based real-time updates, comprehensive logging, and a modern UI built with shadcn/ui components.

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
- **WebSocket Integration**: Real-time bidirectional communication using the 'ws' library
- **In-Memory Storage**: Development storage implementation with plans for database integration
- **API Design**: RESTful endpoints for CRUD operations on servers, devices, and logs
- **Development Integration**: Vite middleware integration for seamless development experience

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
- **Neon Database**: Serverless PostgreSQL database hosting
- **Shadcn/ui**: Component library for consistent UI design
- **Radix UI**: Headless UI primitives for accessible components
- **Material Icons**: Google Material Icons for consistent iconography
- **TanStack Query**: Advanced data synchronization and caching
- **WebSocket (ws)**: Real-time communication protocol implementation
- **Tailwind CSS**: Utility-first CSS framework for rapid styling
- **TypeScript**: Type safety across the entire application stack

The application follows a monorepo structure with shared schemas and types between frontend and backend, ensuring type safety and consistency across the full stack. The architecture is designed for scalability and real-time performance, making it suitable for managing distributed MCP server infrastructures.