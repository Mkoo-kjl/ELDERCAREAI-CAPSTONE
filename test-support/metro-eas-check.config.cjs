// Production bundle verification using the project's actual EAS upload exclusions.
// Use only with --config; this does not change the app's normal Metro config.
const fs = require('node:fs');
const path = require('node:path');
const ignore = require('ignore');
const {getDefaultConfig} = require('expo/metro-config');

const projectRoot = path.resolve(__dirname, '..');
const excluded = ignore().add(fs.readFileSync(path.join(projectRoot, '.easignore'), 'utf8'));
const config = getDefaultConfig(projectRoot);
const originalResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolved = originalResolve
    ? originalResolve(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
  const files = resolved.type === 'sourceFile' ? [resolved.filePath] : resolved.type === 'assetFiles' ? resolved.filePaths : [];
  for (const file of files) {
    const relative = path.relative(projectRoot, file).replace(/\\/g, '/');
    // Dependencies are installed by EAS; Expo generates its own virtual modules.
    if (relative.startsWith('../') || path.isAbsolute(relative) || relative.startsWith('node_modules/') || relative.startsWith('.expo/')) continue;
    if (excluded.ignores(relative)) {
      throw new Error(`Mobile bundle imports a file excluded from the EAS upload: ${relative} (from ${context.originModulePath})`);
    }
  }
  return resolved;
};

module.exports = config;
