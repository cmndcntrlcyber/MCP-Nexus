# GitHub Secrets Setup Guide

## Required Secrets for Deployment

Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):

### 1. CLOUDFLARE_API_TOKEN
**Value:** `Ez036PreIyXEB5whfSZr3fMRR9n50fw7eLlmbWwM`

⚠️ **SECURITY WARNING**: This is your actual API token. Keep it secret and never commit it to code!

### 2. CLOUDFLARE_ACCOUNT_ID  
**Value:** `523d80131d8cba13f765b80d6bb9e096`

### 3. DATABASE_URL
**Value:** Your PostgreSQL connection string
Example: `postgresql://user:password@host:5432/database`

### 4. SESSION_SECRET
**Value:** Generate a secure random string (32+ characters)
You can generate one using: `openssl rand -base64 32`

## How to Add Secrets to GitHub

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Navigate to **Secrets and variables** > **Actions**
4. Click **New repository secret**
5. Enter the secret name and value
6. Click **Add secret**

## Verify Your Setup

After adding all secrets, your Actions secrets page should show:
- ✅ CLOUDFLARE_API_TOKEN
- ✅ CLOUDFLARE_ACCOUNT_ID  
- ✅ DATABASE_URL
- ✅ SESSION_SECRET

## Test Deployment

1. Make a small change to trigger deployment:
```bash
git add .
git commit -m "Test deployment with secrets"
git push origin main
```

2. Check the Actions tab to monitor deployment progress

## Security Best Practices

- **Never** commit API tokens to your repository
- Rotate API tokens regularly
- Use environment-specific tokens (dev/staging/prod)
- Limit token permissions to minimum required
- Monitor token usage in Cloudflare dashboard

## Troubleshooting

If deployment fails:
1. Check Actions logs for specific errors
2. Verify all secrets are properly set
3. Ensure API token has correct permissions:
   - Account - Cloudflare Pages:Edit
   - Account - Account Settings:Read

## Next Steps

Once secrets are configured:
1. Push code to trigger deployment
2. Monitor in GitHub Actions tab
3. Check Cloudflare Pages dashboard
4. Your site will be live at: `https://mcp-server-manager.pages.dev`