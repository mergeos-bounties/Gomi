# Windows Desktop First-Run Checklist

## Prerequisites

1. **Install Node.js** (v18+) from nodejs.org
2. **Install Git** from git-scm.com
3. **Install Visual Studio Build Tools** (for native modules)

## Setup

```powershell
# Clone the repository
git clone https://github.com/mergeos-bounties/Gomi.git
cd Gomi

# Install dependencies
npm install

# Build the application
npm run build

# Start the application
npm start
```

## First-Run Configuration

1. **Open Settings** (Ctrl+,)
2. **Set workspace folder** to your project directory
3. **Configure git path** if not in PATH
4. **Enable auto-save** for convenience

## Common Issues

| Issue | Solution |
|-------|----------|
| Module not found | Run `npm install` again |
| Build fails | Install Build Tools via Visual Studio Installer |
| Git not found | Add Git to PATH or set in settings |
| App won't start | Check Node.js version (v18+) |

## Next Steps

- Read the [User Guide](USER_GUIDE.md)
- Join our [Discord](https://discord.gg/gomi)
- Report issues on [GitHub](https://github.com/mergeos-bounties/Gomi/issues)
