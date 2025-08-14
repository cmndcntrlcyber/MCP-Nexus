# ![](https://github.com/user-attachments/assets/8db0f2c8-52ed-4cf2-ab8c-a839731d701e) MCP Nexus

A comprehensive Model Context Protocol (MCP) Server Manager with real-time monitoring, edge device management, and Cloudflare deployment capabilities.

## Features

- 🚀 **Real MCP Server Management**: Start, stop, and monitor actual MCP server processes
- 🌐 **Edge Device Connectivity**: Secure edge device registration via Cloudflare Tunnels
- 🔒 **Security Controls**: Client certificate validation and device blocking capabilities
- 📊 **Real-time Monitoring**: WebSocket-based live updates and comprehensive logging
- 🎯 **Modern UI**: Built with React, TypeScript, and shadcn/ui components
- ☁️ **Cloudflare Ready**: Configured for deployment to Cloudflare Pages

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TanStack Query, shadcn/ui
- **Backend**: Node.js, Express, WebSocket, @modelcontextprotocol/sdk
- **Database**: PostgreSQL with Drizzle ORM
- **Deployment**: Cloudflare Pages, GitHub Actions

## Prerequisites

- Node.js 20 or higher
- PostgreSQL database (or use Neon Database)
- Cloudflare account (for deployment)
- GitHub account (for repository and CI/CD)

## Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/mcp-server-manager.git
   cd mcp-server-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Push database schema**
   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5000`

## Deployment to Cloudflare Pages

### Initial Setup

1. **Fork or clone this repository to your GitHub account**

2. **Configure GitHub Secrets**
   Go to your repository's Settings > Secrets and variables > Actions, and add:
   - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token with Pages permissions
   - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID (523d80131d8cba13f765b80d6bb9e096)
   - `VITE_API_URL`: Your production API URL (optional, for custom domain)

3. **Create Cloudflare API Token**
   - Go to Cloudflare Dashboard > My Profile > API Tokens
   - Create token with permissions:
     - Account: Cloudflare Pages:Edit
     - Zone: Page Rules:Edit (if using custom domain)

4. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

   The GitHub Action will automatically trigger and deploy to Cloudflare Pages.

### Manual Cloudflare Pages Setup (Alternative)

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Deploy to Cloudflare Pages**
   ```bash
   npx wrangler pages deploy dist --project-name=mcp-server-manager
   ```

## Environment Variables

### Development (.env)
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mcp_manager
PGHOST=localhost
PGPORT=5432
PGUSER=user
PGPASSWORD=password
PGDATABASE=mcp_manager

# Optional: Session Secret
SESSION_SECRET=your-session-secret-here
```

### Production (Cloudflare Pages)
Configure in Cloudflare Pages Dashboard > Settings > Environment Variables:
- `DATABASE_URL`: Production database connection string
- `SESSION_SECRET`: Secure session secret
- `NODE_ENV`: production

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/        # Page components
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Utilities and helpers
├── server/                # Express backend
│   ├── mcp/              # MCP server management
│   ├── routes.ts         # API routes
│   ├── storage.ts        # Storage interface
│   └── db.ts            # Database connection
├── shared/               # Shared types and schemas
│   └── schema.ts        # Drizzle ORM schemas
├── .github/
│   └── workflows/       # GitHub Actions
└── cloudflare/          # Cloudflare Workers (optional)
```

## Key Features

### Device Management
- Register edge devices with unique IDs
- Client certificate validation
- Device blocking/unblocking capabilities
- Force deletion with automatic server cleanup

### Server Management
- Real-time server process spawning
- Auto-restart with configurable limits
- Environment variable support
- Command-line argument configuration

### Security
- Certificate fingerprint tracking
- Subject and expiry validation
- Device access control
- Secure WebSocket communication

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please use the GitHub Issues page.

## Acknowledgments

- Built with [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Deployed on [Cloudflare Pages](https://pages.cloudflare.com)
