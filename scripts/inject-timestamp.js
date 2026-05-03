const fs = require('fs');
const path = require('path');

/**
 * Inject build timestamp into index.html
 * Runs automatically after each build
 */

const buildFile = path.join(__dirname, '../build/index.html');
const timestamp = Date.now();

try {
  if (fs.existsSync(buildFile)) {
    let content = fs.readFileSync(buildFile, 'utf8');
    content = content.replace('{BUILD_TIMESTAMP}', timestamp.toString());
    fs.writeFileSync(buildFile, content, 'utf8');
    console.log(`✓ Build timestamp injected: ${timestamp} (${new Date(timestamp).toLocaleString()})`);
  } else {
    console.warn(`✗ Build file not found: ${buildFile}`);
    process.exit(1);
  }
} catch (error) {
  console.error('✗ Failed to inject timestamp:', error);
  process.exit(1);
}
