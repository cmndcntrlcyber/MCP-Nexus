#!/bin/bash

# MCP Server Manager - GitHub Repository Setup Script
# This script helps you set up your GitHub repository for deployment

echo "======================================"
echo "MCP Server Manager - GitHub Setup"
echo "======================================"
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "Error: Git is not installed. Please install git first."
    exit 1
fi

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo "Initializing git repository..."
    git init
    echo "✓ Git repository initialized"
else
    echo "✓ Git repository already exists"
fi

# Get GitHub username
echo ""
read -p "Enter your GitHub username: " github_username
if [ -z "$github_username" ]; then
    echo "Error: GitHub username is required"
    exit 1
fi

# Get repository name
read -p "Enter repository name (default: mcp-server-manager): " repo_name
repo_name=${repo_name:-mcp-server-manager}

# Check if remote already exists
if git remote | grep -q origin; then
    echo ""
    echo "⚠️  Remote 'origin' already exists"
    read -p "Do you want to replace it? (y/n): " replace_remote
    if [ "$replace_remote" = "y" ]; then
        git remote remove origin
        echo "✓ Old remote removed"
    else
        echo "Keeping existing remote"
        exit 0
    fi
fi

# Add remote
echo ""
echo "Adding GitHub remote..."
git remote add origin "https://github.com/$github_username/$repo_name.git"
echo "✓ Remote added: https://github.com/$github_username/$repo_name.git"

# Stage all files
echo ""
echo "Staging files..."
git add .
echo "✓ Files staged"

# Create initial commit
echo ""
read -p "Enter commit message (default: 'Initial commit: MCP Server Manager'): " commit_msg
commit_msg=${commit_msg:-"Initial commit: MCP Server Manager"}
git commit -m "$commit_msg" 2>/dev/null || echo "✓ Already committed"

# Display next steps
echo ""
echo "======================================"
echo "✅ GitHub Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Create a private repository on GitHub:"
echo "   https://github.com/new"
echo "   - Name: $repo_name"
echo "   - Visibility: Private"
echo "   - Do NOT initialize with README"
echo ""
echo "2. Push your code:"
echo "   git push -u origin main"
echo ""
echo "3. Configure GitHub Secrets (Settings > Secrets > Actions):"
echo "   - CLOUDFLARE_API_TOKEN"
echo "   - CLOUDFLARE_ACCOUNT_ID (523d80131d8cba13f765b80d6bb9e096)"
echo "   - DATABASE_URL"
echo "   - SESSION_SECRET"
echo ""
echo "4. The deployment will trigger automatically on push!"
echo ""
echo "For detailed instructions, see: docs/DEPLOYMENT.md"
echo "======================================"