# Cloudflare Pages Deployment Setup

## The Issue
Your deployment is failing with "Failed to get Pages project" (404 error) because the Pages project doesn't exist yet in your Cloudflare account.

## Required GitHub Secrets

You need to add these secrets to your GitHub repository:

### 1. CLOUDFLARE_API_TOKEN ⚠️ REQUIRED
You need to generate a NEW Cloudflare API token with the correct permissions.

**How to generate the token:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use "Custom token" template
4. Configure these permissions:
   - **Account** → Cloudflare Pages:Edit
   - **Account** → Account Settings:Read
   - **Zone** → Zone Settings:Read (optional, if you plan to use custom domains)
5. Account Resources: Include → Your account (523d80131d8cba13f765b80d6bb9e096)
6. Click "Continue to summary"
7. Click "Create Token"
8. Copy the token immediately (you won't see it again!)

### 2. CLOUDFLARE_ACCOUNT_ID (Optional - already in workflow)
- Value: `523d80131d8cba13f765b80d6bb9e096`
- This is already hardcoded in the workflow as a fallback

## Adding Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add:
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: [Your new token from step 1]
5. Click **Add secret**

## First Deployment

The Pages project will be automatically created on the first successful deployment. The workflow will:
1. Build your application
2. Create the Pages project "mcp-server-manager" if it doesn't exist
3. Deploy the built files to Cloudflare Pages

## Verify Token Permissions

Your token MUST have these permissions:
- ✅ Account - Cloudflare Pages:Edit (to create and deploy projects)
- ✅ Account - Account Settings:Read (to access account details)

## After Setup

1. Push any change to the main branch to trigger deployment:
```bash
git add .
git commit -m "Trigger deployment with Cloudflare Pages"
git push origin main
```

2. Monitor the deployment in the GitHub Actions tab

3. Once successful, your app will be available at:
   - `https://mcp-server-manager.pages.dev`

## Troubleshooting

If you still get errors:
1. **404 Error**: Token doesn't have Pages:Edit permission
2. **403 Error**: Token is invalid or doesn't have access to the account
3. **401 Error**: Token is not set in GitHub secrets

## Important Notes

- The Pages project will be created automatically on first deployment
- You don't need to manually create the project in Cloudflare
- The token you provided earlier might not have the correct permissions
- Generate a NEW token with the exact permissions listed above