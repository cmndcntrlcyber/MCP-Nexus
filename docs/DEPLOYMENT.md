# Complete Deployment Guide for MCP Server Manager

## Prerequisites

Before deploying, ensure you have:
1. A GitHub repository with the code
2. A Cloudflare account (free tier works)
3. The application builds successfully locally (`npm run build`)

## Step 1: Generate Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Select **Custom token** template
4. Configure permissions:
   - **Account** → Cloudflare Pages: Edit
   - **Account** → Account Settings: Read
   - **Zone** → Zone Settings: Read (optional for custom domains)
5. Account Resources:
   - Include → `523d80131d8cba13f765b80d6bb9e096` (your account ID)
6. Click **Continue to summary**
7. Click **Create Token**
8. **Copy the token immediately** (you won't see it again!)

## Step 2: Add GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secret:
   - **Name:** `CLOUDFLARE_API_TOKEN`
   - **Value:** [Your token from Step 1]
5. Click **Add secret**

## Step 3: Manual Cloudflare Pages Setup (Alternative Method)

If automatic deployment fails, you can manually create the Pages project:

### Create Pages Project in Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** → **Pages**
3. Click **Create a project**
4. Choose **Connect to Git**
5. Select your GitHub repository
6. Configure build settings:

   **Build Settings:**
   - **Framework preset:** None
   - **Build command:** `npm run build`
   - **Build output directory:** `/dist/public`
   
   **Advanced Settings:**
   - **Root directory:** `/` (leave as default)
   - **Environment variables:** Add if needed:
     - `NODE_VERSION`: `20`
     - Any other production variables

7. Click **Save and Deploy**

### Important Build Configuration Notes

- **Framework preset:** Must be set to "None" (not auto-detected)
- **Build command:** `npm run build`
- **Build output directory:** `/dist/public` (NOT just `/` or `/dist`)
- The build creates both server files and public assets
- Only the public assets in `/dist/public` are deployed to Pages

## Step 4: Trigger Deployment

### Via GitHub Actions (Recommended)

1. Push any change to the main branch:
```bash
git add .
git commit -m "Deploy to Cloudflare Pages"
git push origin main
```

2. Monitor deployment:
   - Go to GitHub → Actions tab
   - Watch the "Deploy to Cloudflare Pages" workflow
   - Check for any errors in the logs

### Via Cloudflare Dashboard (Manual)

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your project
3. Click **Create deployment**
4. Choose branch and deploy

## Step 5: Verify Deployment

1. Check deployment status in Cloudflare Dashboard
2. Once successful, your app will be available at:
   - `https://mcp-server-manager.pages.dev`
   - Or your custom domain if configured

## Environment Variables

### Production Variables (Set in Cloudflare Pages)

Navigate to **Settings** → **Environment variables** in your Pages project:

- `DATABASE_URL`: Your production PostgreSQL connection string
- `SESSION_SECRET`: Generate with `openssl rand -base64 32`
- `NODE_VERSION`: `20` (if needed)

### Build-time Variables (Set in GitHub Secrets)

These are used during the build process:
- `CLOUDFLARE_API_TOKEN`: Your API token
- `CLOUDFLARE_ACCOUNT_ID`: `523d80131d8cba13f765b80d6bb9e096` (optional, hardcoded as fallback)

## Troubleshooting

### Build Failures

1. **PostCSS/Tailwind errors:**
   - Ensure `postcss.config.cjs` exists (not `.js`)
   - Check that `@tailwindcss/vite` is not installed

2. **Module not found errors:**
   - Run `npm ci` locally to verify dependencies
   - Check `package.json` for missing dependencies

3. **Build output not found:**
   - Verify build output directory is `/dist/public`
   - Check that `npm run build` creates this directory

### Deployment Failures

1. **404 Error - Pages project not found:**
   - The project doesn't exist yet
   - Either wait for auto-creation or create manually
   - Verify API token has Pages:Edit permission

2. **403 Error - Forbidden:**
   - API token lacks necessary permissions
   - Regenerate token with correct permissions

3. **401 Error - Unauthorized:**
   - API token not set in GitHub secrets
   - Token is invalid or expired

### GitHub Actions Failures

1. **Permission errors on PRs:**
   - This is expected for security
   - Check workflow summary instead of PR comments
   - Dependabot PRs have restricted permissions

2. **Artifacts not uploaded:**
   - Check build completes successfully
   - Verify `dist/public` directory exists

## Production Considerations

### Database Setup

1. Use a production PostgreSQL database (e.g., Neon, Supabase)
2. Set `DATABASE_URL` in Cloudflare Pages environment variables
3. Run migrations if needed

### Security

1. **Never commit secrets to code**
2. Use environment variables for sensitive data
3. Rotate API tokens regularly
4. Enable 2FA on GitHub and Cloudflare accounts

### Custom Domain

1. Go to Pages project → **Custom domains**
2. Add your domain
3. Configure DNS records as instructed
4. SSL certificate is automatic

## Monitoring

### Cloudflare Analytics

- View in Pages project dashboard
- Monitor request counts, errors, performance

### GitHub Actions

- Check Actions tab for deployment history
- Set up notifications for failed deployments

### Application Logs

- Use Cloudflare Workers logs for debugging
- Implement error tracking (e.g., Sentry)

## Rollback Process

If deployment causes issues:

1. **Via Cloudflare Dashboard:**
   - Go to Deployments tab
   - Find previous working deployment
   - Click "Rollback to this deployment"

2. **Via Git:**
   - Revert the problematic commit
   - Push to trigger new deployment

## Support

- **Build issues:** Check `docs/GITHUB_ACTIONS_FIX.md`
- **API token issues:** Check `docs/CLOUDFLARE_PAGES_SETUP.md`
- **General setup:** Check `docs/SETUP_SECRETS.md`

## Quick Checklist

- [ ] Cloudflare API token generated with Pages:Edit permission
- [ ] GitHub secret `CLOUDFLARE_API_TOKEN` added
- [ ] Build works locally (`npm run build`)
- [ ] PostCSS config is `.cjs` not `.js`
- [ ] Build output directory set to `/dist/public`
- [ ] First deployment triggered
- [ ] Production environment variables configured
- [ ] Site accessible at `.pages.dev` domain