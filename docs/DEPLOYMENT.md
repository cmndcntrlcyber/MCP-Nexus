# Deployment Guide for MCP Server Manager

This guide provides detailed instructions for deploying the MCP Server Manager to Cloudflare Pages using GitHub Actions.

## Prerequisites

Before starting the deployment process, ensure you have:

1. **GitHub Account**: Required for hosting the repository and running CI/CD
2. **Cloudflare Account**: Required for hosting the application
3. **PostgreSQL Database**: Production database (recommend Neon or Supabase)
4. **Node.js 20+**: For local testing before deployment

## Step 1: Prepare Your Repository

### 1.1 Create a Private GitHub Repository

1. Go to [GitHub](https://github.com/new)
2. Name your repository (e.g., `mcp-server-manager`)
3. Set visibility to **Private**
4. Do not initialize with README (we already have one)
5. Click "Create repository"

### 1.2 Push Code to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit changes
git commit -m "Initial commit: MCP Server Manager"

# Add your GitHub repository as origin
git remote add origin https://github.com/YOUR_USERNAME/mcp-server-manager.git

# Push to main branch
git push -u origin main
```

## Step 2: Set Up Cloudflare

### 2.1 Create Cloudflare API Token

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to **My Profile** > **API Tokens**
3. Click **Create Token**
4. Use **Custom token** template with these permissions:
   - **Account** - Cloudflare Pages:Edit
   - **Account** - Account Settings:Read
   - **Zone** - Page Rules:Edit (if using custom domain)
5. Set Account Resources to your specific account
6. Click **Continue to summary** > **Create Token**
7. **Copy the token** (you won't see it again!)

### 2.2 Get Your Account ID

1. In Cloudflare Dashboard, select your account
2. Find Account ID in the right sidebar
3. Copy it (should be: `523d80131d8cba13f765b80d6bb9e096`)

## Step 3: Configure GitHub Secrets

### 3.1 Navigate to Repository Settings

1. Go to your GitHub repository
2. Click **Settings** tab
3. Navigate to **Secrets and variables** > **Actions**

### 3.2 Add Required Secrets

Click **New repository secret** for each:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `CLOUDFLARE_API_TOKEN` | Your API token from Step 2.1 | Authentication for Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID` | `523d80131d8cba13f765b80d6bb9e096` | Your Cloudflare account ID |
| `DATABASE_URL` | `postgresql://...` | Production database connection string |
| `SESSION_SECRET` | Generate a secure random string | For session encryption |

### 3.3 Add Optional Secrets

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `VITE_API_URL` | `https://your-domain.com` | Custom API domain (if applicable) |

## Step 4: Configure Production Database

### 4.1 Using Neon Database (Recommended)

1. Sign up at [Neon](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Add it as `DATABASE_URL` secret in GitHub

### 4.2 Database Schema Setup

The GitHub Action will handle database migrations automatically. Ensure your database user has permission to create tables.

## Step 5: Deploy to Cloudflare Pages

### 5.1 Initial Deployment

1. Make a small change to trigger deployment:
   ```bash
   echo "# Deployed on $(date)" >> README.md
   git add README.md
   git commit -m "Trigger initial deployment"
   git push origin main
   ```

2. Go to **Actions** tab in your GitHub repository
3. Watch the "Deploy to Cloudflare Pages" workflow run
4. Once complete, find your site URL in the workflow logs

### 5.2 Verify Deployment

1. Visit the Cloudflare Pages dashboard
2. Find your project (`mcp-server-manager`)
3. Click on it to see deployment details
4. Your site will be available at:
   - `https://mcp-server-manager.pages.dev`
   - Or your custom domain if configured

## Step 6: Configure Custom Domain (Optional)

### 6.1 Add Custom Domain

1. In Cloudflare Pages project settings
2. Go to **Custom domains** tab
3. Click **Set up a custom domain**
4. Enter your domain name
5. Follow DNS configuration instructions

### 6.2 Update Environment Variables

Add your custom domain to GitHub Secrets:
- `VITE_API_URL`: `https://your-custom-domain.com`

## Step 7: Production Environment Variables

### 7.1 In Cloudflare Pages Dashboard

1. Go to your project settings
2. Navigate to **Environment variables**
3. Add production variables:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: Your production database URL
   - `SESSION_SECRET`: Secure random string

## Troubleshooting

### Build Failures

1. Check GitHub Actions logs for errors
2. Ensure all secrets are properly set
3. Verify Node.js version compatibility

### Database Connection Issues

1. Verify `DATABASE_URL` is correct
2. Check database is accessible from Cloudflare
3. Ensure SSL is properly configured

### Deployment Not Triggering

1. Ensure GitHub Actions are enabled
2. Check workflow file syntax
3. Verify branch name matches workflow trigger

## Security Best Practices

1. **Never commit secrets** to the repository
2. **Use strong passwords** for database
3. **Rotate API tokens** regularly
4. **Enable 2FA** on GitHub and Cloudflare
5. **Restrict database access** to Cloudflare IPs only
6. **Use environment-specific** configurations

## Monitoring

### GitHub Actions

- Monitor workflow runs in Actions tab
- Set up email notifications for failures
- Review deployment logs regularly

### Cloudflare Analytics

- Check Pages Analytics for traffic
- Monitor Web Analytics for performance
- Review Workers Analytics if using Workers

## Rollback Procedure

If deployment fails or causes issues:

1. **Via Cloudflare Dashboard**:
   - Go to project > Deployments
   - Find previous successful deployment
   - Click "Rollback to this deployment"

2. **Via GitHub**:
   - Revert the problematic commit
   - Push to trigger new deployment

## Maintenance

### Regular Updates

1. Keep dependencies updated:
   ```bash
   npm update
   npm audit fix
   ```

2. Update GitHub Actions:
   - Check for new versions of actions
   - Update Node.js version as needed

3. Database maintenance:
   - Regular backups
   - Monitor performance
   - Clean up old logs

## Support

For deployment issues:
- Check [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- Review [GitHub Actions Docs](https://docs.github.com/en/actions)
- Open an issue in the repository

## Next Steps

After successful deployment:
1. Configure monitoring and alerts
2. Set up custom domain (if needed)
3. Implement authentication
4. Configure backup strategies
5. Set up staging environment