# TypeScript Compilation Issues - Solutions

## Common TypeScript Errors

### Error 1: Cannot find module '@eventhub/shared-utils'

**Error Message:**
```
error TS2307: Cannot find module '@eventhub/shared-utils' or its corresponding type declarations.
```

**Cause:** Shared packages not built yet.

**Solution:**
```bash
# Option 1: Run setup (does everything)
bash setup.sh

# Option 2: Build shared packages manually
bash build.sh --shared-only

# Option 3: Build step by step
cd shared/types && npm run build && cd ../..
cd shared/utils && npm run build && cd ../..
```

### Error 2: JWT Sign/Verify Type Errors

**Error Message:**
```
error TS2769: No overload matches this call.
Overload 1 of 5, '(payload: string | object | Buffer...
```

**Cause:** Incorrect TypeScript types for jsonwebtoken.

**Solution:** Already fixed in the latest version. The JWT utils now properly import `SignOptions`:

```typescript
import jwt, { SignOptions } from 'jsonwebtoken';

const options: SignOptions = {
  expiresIn: this.accessTokenExpiry
};
return jwt.sign(payload, this.secret, options);
```

If you still see this error, rebuild:
```bash
cd shared/utils
npm run build
```

### Error 3: Prisma Client Not Generated

**Error Message:**
```
error TS2307: Cannot find module '@prisma/client'
```

**Solution:**
```bash
cd services/user-service
npx prisma generate
```

### Error 4: Type Errors After Updating Code

**Cause:** Stale compiled files.

**Solution:**
```bash
# Clean and rebuild
bash build.sh --clean

# Or manually
rm -rf shared/*/dist
rm -rf services/*/dist
bash build.sh
```

### Error 5: Module Resolution Issues

**Error Message:**
```
error TS2688: Cannot find type definition file for 'node'
```

**Solution:**
```bash
# Install all dependencies
npm install

# Rebuild
bash build.sh
```

## Build Order (CRITICAL!)

**Always build in this order:**

1. ✅ **shared/types** (no dependencies)
2. ✅ **shared/utils** (depends on types)
3. ✅ **services/** (depend on both shared packages)

```bash
# Correct order
cd shared/types && npm run build
cd ../utils && npm run build
cd ../../services/user-service && npm run build

# Or use the build script
bash build.sh
```

## Verification Steps

### 1. Check Shared Packages Built
```bash
# Should see compiled JavaScript files
ls shared/types/dist/
ls shared/utils/dist/

# Should include:
# - index.js
# - index.d.ts
# - (other compiled files)
```

### 2. Check Service Can Import
```bash
cd services/user-service

# This should work
node -e "require('@eventhub/shared-utils')"

# If error, rebuild shared packages
```

### 3. Check TypeScript Compilation
```bash
cd services/user-service

# Should compile without errors
npx tsc --noEmit
```

## Development Workflow

### Making Changes to Shared Packages

**Step 1: Edit Code**
```bash
# Edit shared/utils/src/jwt-utils.ts
vim shared/utils/src/jwt-utils.ts
```

**Step 2: Rebuild**
```bash
cd shared/utils
npm run build
cd ../..
```

**Step 3: Restart Services**
```bash
# Services will pick up new version
# In dev mode, they should auto-restart
```

### Making Changes to Services

Services with `ts-node-dev` auto-restart:
```bash
# Just edit and save
vim services/user-service/src/controllers/auth.controller.ts
# Auto-reloads!
```

## Build Scripts Reference

### setup.sh
- Installs all dependencies
- Builds all shared packages
- Generates Prisma client
- **Use once** when first setting up

### build.sh
- Builds shared packages and services
- Options:
  - `--clean`: Clean before building
  - `--shared-only`: Build only shared packages
  - `--help`: Show help

```bash
# Examples
bash build.sh                 # Build everything
bash build.sh --clean         # Clean and build
bash build.sh --shared-only   # Only shared packages
```

## Clean Slate (Nuclear Option)

If nothing works, start fresh:

```bash
#!/bin/bash
# WARNING: This deletes everything!

# Stop all processes
docker-compose down -v

# Delete all build artifacts
rm -rf node_modules
rm -rf shared/types/node_modules shared/types/dist
rm -rf shared/utils/node_modules shared/utils/dist
rm -rf services/*/node_modules services/*/dist
rm -rf package-lock.json

# Start fresh
npm install
bash setup.sh
```

## Common Patterns

### Pattern 1: Just Updated Shared Utils
```bash
cd shared/utils
npm run build
# Services will auto-reload in dev mode
```

### Pattern 2: Cloned Fresh Repo
```bash
bash setup.sh
docker-compose up -d postgres redis kafka
cd services/user-service && npm run prisma:migrate
npm run dev:user
```

### Pattern 3: TypeScript Errors After Pull
```bash
bash build.sh --clean
```

### Pattern 4: Testing Production Build
```bash
bash build.sh
cd services/user-service && npm start
```

## IDE Issues

### VS Code TypeScript Errors

**Issue:** Red squiggly lines but compiles fine.

**Solution:**
```bash
# Restart TypeScript server
# In VS Code: Cmd/Ctrl + Shift + P
# Type: "TypeScript: Restart TS Server"
```

### IntelliSense Not Working

**Solution:**
```bash
# Make sure shared packages are built
bash build.sh --shared-only

# Reload VS Code window
# Cmd/Ctrl + Shift + P -> "Developer: Reload Window"
```

## Package.json Scripts

### Root package.json
```json
{
  "scripts": {
    "setup": "bash setup.sh",
    "build:shared": "npm run build --workspace=shared/types && npm run build --workspace=shared/utils",
    "dev:user": "npm run dev --workspace=services/user-service",
    "dev:gateway": "npm run dev --workspace=services/api-gateway"
  }
}
```

### Usage
```bash
npm run setup          # First time setup
npm run build:shared   # Just rebuild shared packages
npm run dev:user       # Start user service in dev mode
npm run dev:gateway    # Start API gateway in dev mode
```

## Environment-Specific Issues

### Windows Users

If using Windows, use Git Bash or WSL:
```bash
# In Git Bash or WSL
bash setup.sh
bash build.sh
```

Or use npm scripts:
```bash
npm run setup
npm run build:shared
```

### Mac/Linux Users

Scripts should work directly:
```bash
bash setup.sh
bash build.sh
```

## Debugging TypeScript

### Enable Verbose Logging
```bash
# In any service
npx tsc --noEmit --listFiles

# Shows all files being compiled
# Useful to verify shared packages are found
```

### Check Module Resolution
```bash
npx tsc --noEmit --traceResolution

# Shows how TypeScript resolves modules
# Useful for debugging import issues
```

### Check Types
```bash
# Check if types are properly exported
cat shared/types/dist/index.d.ts
cat shared/utils/dist/index.d.ts
```

## Still Having Issues?

1. **Delete everything and start fresh** (nuclear option above)
2. **Check you're using Node 20+**: `node --version`
3. **Check npm version**: `npm --version` (should be 9+)
4. **Verify setup order**: shared/types → shared/utils → services
5. **Check logs**: Look for actual error, not just symptoms
6. **Create minimal reproduction**: Test with simple import

## Quick Diagnostic
```bash
#!/bin/bash
echo "=== TypeScript Build Diagnostic ==="
echo ""
echo "Node version:"
node --version
echo ""
echo "NPM version:"
npm --version
echo ""
echo "Shared types built:"
ls -la shared/types/dist/ 2>/dev/null || echo "NOT BUILT"
echo ""
echo "Shared utils built:"
ls -la shared/utils/dist/ 2>/dev/null || echo "NOT BUILT"
echo ""
echo "Can import shared-utils:"
cd services/user-service
node -e "require('@eventhub/shared-utils')" && echo "YES" || echo "NO"
cd ../..
```

Save this as `diagnose.sh` and run it to check your setup!

Happy building! 🔨
