# Quick Start Guide - Deploy to GitHub & Cloudflare Pages

## 🚀 5-Minute Deployment

### Step 1: Run Setup Script
```bash
./scripts/setup-github.sh
```
This will:
- Initialize git repository
- Configure GitHub remote
- Stage and commit your files

### Step 2: Create GitHub Repository
1. Go to https://github.com/new
2. Create a **PRIVATE** repository named `mcp-server-manager`
3. Do NOT initialize with README
4. Click "Create repository"

### Step 3: Push Code
```bash
git push -u origin main
```

### Step 4: Configure Secrets
Go to your repository Settings > Secrets and variables > Actions

Add these secrets:
- `CLOUDFLARE_API_TOKEN`: Your token (see docs/SETUP_SECRETS.md for details)
- `CLOUDFLARE_ACCOUNT_ID`: `523d80131d8cba13f765b80d6bb9e096`
- `DATABASE_URL`: Your PostgreSQL connection string
- `SESSION_SECRET`: Any secure random string

📋 **Important**: Check `docs/SETUP_SECRETS.md` for your specific token and detailed instructions!

### Step 5: Deploy!
The GitHub Action will automatically deploy to Cloudflare Pages.

Your site will be available at:
- https://mcp-server-manager.pages.dev

## 📋 Pre-Deployment Checklist

- [ ] GitHub account created
- [ ] Cloudflare account created
- [ ] PostgreSQL database ready (recommend [Neon](https://neon.tech))
- [ ] Cloudflare API token created

## 🔧 Cloudflare API Token Setup

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to My Profile > API Tokens
3. Click "Create Token"
4. Use "Custom token" with permissions:
   - Account - Cloudflare Pages:Edit
   - Account - Account Settings:Read
5. Create and copy token

## 🗄️ Database Setup (Neon)

1. Sign up at https://neon.tech
2. Create new project
3. Copy connection string
4. Add as `DATABASE_URL` secret in GitHub

## 🎯 After Deployment

1. Visit Cloudflare Pages dashboard
2. Find your project
3. Configure custom domain (optional)
4. Set production environment variables

## ❓ Need Help?

- Detailed guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Check GitHub Actions logs for errors
- Verify all secrets are properly set

## 🔐 Security Notes

- Keep repository PRIVATE
- Never commit `.env` files
- Rotate API tokens regularly
- Use strong database passwords

---

**Ready to deploy?** Run `./scripts/setup-github.sh` to get started!