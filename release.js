#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ReleaseManager {
    constructor() {
        this.packagePath = './package.json';
        this.mainFile = './FxFilter.js';
        this.ghPagesDir = './gh-pages';
        this.versionsFile = 'versions.js';
    }

    // Get current version from package.json
    getCurrentVersion() {
        const packageJson = JSON.parse(fs.readFileSync(this.packagePath, 'utf8'));
        return packageJson.version || '1.0.0';
    }

    // Increment version based on type
    incrementVersion(currentVersion, type) {
        const [major, minor, patch] = currentVersion.split('.').map(Number);
        
        switch (type) {
            case 'major':
                return `${major + 1}.0.0`;
            case 'minor':
                return `${major}.${minor + 1}.0`;
            case 'patch':
                return `${major}.${minor}.${patch + 1}`;
            default:
                throw new Error('Invalid version type. Use: major, minor, or patch');
        }
    }

    // Update package.json version
    updatePackageVersion(newVersion) {
        const packageJson = JSON.parse(fs.readFileSync(this.packagePath, 'utf8'));
        packageJson.version = newVersion;
        fs.writeFileSync(this.packagePath, JSON.stringify(packageJson, null, 2) + '\n');
        console.log(`📦 Updated package.json to version ${newVersion}`);
    }

    // Run command and return output
    runCommand(command, description) {
        console.log(`🔄 ${description}`);
        try {
            const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
            return output.trim();
        } catch (error) {
            console.error(`❌ Failed: ${description}`);
            console.error(error.message);
            process.exit(1);
        }
    }

    // Check if git working directory is clean
    checkGitStatus() {
        try {
            const status = execSync('git status --porcelain', { encoding: 'utf8' });
            if (status.trim()) {
                console.log('⚠️  Warning: Working directory is not clean. Uncommitted changes:');
                console.log(status);
                return false;
            }
            return true;
        } catch (error) {
            console.error('❌ Error checking git status:', error.message);
            return false;
        }
    }

    // Create and push git tag
    createGitTag(version) {
        this.runCommand(`git add ${this.packagePath}`, 'Staging package.json');
        this.runCommand(`git commit -m "chore: bump version to ${version}"`, 'Committing version bump');
        this.runCommand(`git tag -a v${version} -m "Release version ${version}"`, 'Creating git tag');
        this.runCommand('git push origin main', 'Pushing to main branch');
        this.runCommand(`git push origin v${version}`, 'Pushing tag');
        console.log(`🏷️  Created and pushed tag v${version}`);
    }

    // Create GitHub release
    createGitHubRelease(version) {
        // Check if gh CLI is available
        try {
            execSync('gh --version', { stdio: 'pipe' });
        } catch (error) {
            console.log('⚠️  GitHub CLI (gh) not found. Skipping GitHub release creation.');
            console.log('💡 Install with: brew install gh');
            return;
        }

        // Create release with FxFilter.js as asset
        const releaseCommand = `gh release create v${version} ${this.mainFile} --title "Release v${version}" --notes "Release version ${version}"`;
        this.runCommand(releaseCommand, 'Creating GitHub release');
        console.log(`🚀 Created GitHub release v${version} with FxFilter.js`);
    }

    // Setup gh-pages directory structure
    setupGhPages() {
        if (!fs.existsSync(this.ghPagesDir)) {
            fs.mkdirSync(this.ghPagesDir, { recursive: true });
        }

        // Create or switch to gh-pages branch
        try {
            this.runCommand('git checkout gh-pages', 'Switching to gh-pages branch');
        } catch (error) {
            console.log('📄 Creating new gh-pages branch');
            this.runCommand('git checkout --orphan gh-pages', 'Creating gh-pages branch');
            this.runCommand('git rm -rf .', 'Cleaning gh-pages branch');
        }
    }

    // Generate versions.js file
    generateVersionsFile(versions, latestVersion) {
        const versionsContent = `// FxFilter.js Versions Registry
// Generated automatically by release script
// Last updated: ${new Date().toISOString()}

window.FxFilterVersions = {
    latest: "${latestVersion}",
    versions: ${JSON.stringify(versions, null, 4)},
    
    // Get download URL for specific version
    getVersionUrl: function(version) {
        const baseUrl = window.location.origin + window.location.pathname.replace(/\\/[^/]*$/, '');
        if (version === 'latest') {
            return baseUrl + '/FxFilter.js';
        }
        return baseUrl + '/v' + version + '/FxFilter.js';
    },
    
    // Load specific version dynamically
    loadVersion: function(version) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = this.getVersionUrl(version);
            script.onload = () => resolve(window.FxFilter);
            script.onerror = () => reject(new Error('Failed to load version ' + version));
            document.head.appendChild(script);
        });
    }
};

// For Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.FxFilterVersions;
}
`;
        return versionsContent;
    }

    // Update GitHub Pages
    updateGhPages(version) {
        console.log('📄 Updating GitHub Pages...');
        
        // Switch to main branch and get the latest file
        this.runCommand('git checkout main', 'Switching to main branch');
        
        // Ensure gh-pages directory exists
        if (!fs.existsSync(this.ghPagesDir)) {
            fs.mkdirSync(this.ghPagesDir, { recursive: true });
        }

        // Copy current FxFilter.js to gh-pages directory
        process.chdir(this.ghPagesDir);

        // Initialize git if needed
        if (!fs.existsSync('.git')) {
            this.runCommand('git init', 'Initializing git in gh-pages directory');
            this.runCommand('git remote add origin $(cd .. && git remote get-url origin)', 'Adding remote origin');
        }

        // Try to checkout gh-pages branch, create if doesn't exist
        try {
            this.runCommand('git checkout gh-pages', 'Switching to gh-pages branch');
            this.runCommand('git pull origin gh-pages || true', 'Pulling latest gh-pages');
        } catch (error) {
            console.log('📄 Creating new gh-pages branch');
            this.runCommand('git checkout -b gh-pages', 'Creating gh-pages branch');
        }

        // Create version directory
        const versionDir = `v${version}`;
        if (!fs.existsSync(versionDir)) {
            fs.mkdirSync(versionDir, { recursive: true });
        }

        // Copy FxFilter.js to version directory and root
        fs.copyFileSync(path.join('..', this.mainFile), path.join(versionDir, 'FxFilter.js'));
        fs.copyFileSync(path.join('..', this.mainFile), 'FxFilter.js');

        // Read existing versions or create new
        let versions = [];
        if (fs.existsSync(this.versionsFile)) {
            try {
                const existingContent = fs.readFileSync(this.versionsFile, 'utf8');
                const match = existingContent.match(/versions:\s*(\[[\s\S]*?\])/);
                if (match) {
                    versions = JSON.parse(match[1]);
                }
            } catch (error) {
                console.log('⚠️  Could not parse existing versions, starting fresh');
            }
        }

        // Add new version if not already present
        if (!versions.find(v => v.version === version)) {
            versions.unshift({
                version: version,
                date: new Date().toISOString().split('T')[0],
                tag: `v${version}`,
                url: `./v${version}/FxFilter.js`
            });
        }

        // Sort versions (latest first)
        versions.sort((a, b) => {
            const [aMajor, aMinor, aPatch] = a.version.split('.').map(Number);
            const [bMajor, bMinor, bPatch] = b.version.split('.').map(Number);
            
            if (aMajor !== bMajor) return bMajor - aMajor;
            if (aMinor !== bMinor) return bMinor - aMinor;
            return bPatch - aPatch;
        });

        // Generate versions.js
        const versionsContent = this.generateVersionsFile(versions, version);
        fs.writeFileSync(this.versionsFile, versionsContent);

        // Create simple index.html for GitHub Pages
        const indexContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FxFilter.js - Releases</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; }
        .version { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .latest { background-color: #f0f8ff; border-color: #007acc; }
        a { color: #007acc; text-decoration: none; }
        a:hover { text-decoration: underline; }
        pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>🎨 FxFilter.js Releases</h1>
    <p>CSS effects library with dynamic filter management</p>
    
    <h2>📦 Latest Version</h2>
    <div class="version latest">
        <h3>v${version} (Latest)</h3>
        <p><strong>Download:</strong> <a href="./FxFilter.js" download>FxFilter.js</a></p>
        <p><strong>CDN:</strong> <code>https://[your-username].github.io/FxFilterJS/FxFilter.js</code></p>
    </div>

    <h2>📋 All Versions</h2>
    <div id="versions"></div>

    <h2>🔧 Usage</h2>
    <pre><code>// Load latest version
&lt;script src="https://[your-username].github.io/FxFilterJS/FxFilter.js"&gt;&lt;/script&gt;

// Load specific version
&lt;script src="https://[your-username].github.io/FxFilterJS/v1.0.0/FxFilter.js"&gt;&lt;/script&gt;

// Load dynamically
&lt;script src="https://[your-username].github.io/FxFilterJS/versions.js"&gt;&lt;/script&gt;
&lt;script&gt;
    FxFilterVersions.loadVersion('1.0.0').then(FxFilter => {
        // Use FxFilter here
    });
&lt;/script&gt;</code></pre>

    <script src="./versions.js"></script>
    <script>
        // Populate versions list
        const versionsDiv = document.getElementById('versions');
        FxFilterVersions.versions.forEach(version => {
            const div = document.createElement('div');
            div.className = 'version';
            div.innerHTML = \`
                <h3>v\${version.version}</h3>
                <p><strong>Date:</strong> \${version.date}</p>
                <p><strong>Download:</strong> <a href="\${version.url}" download>FxFilter.js</a></p>
                <p><strong>CDN:</strong> <code>https://[your-username].github.io/FxFilterJS/v\${version.version}/FxFilter.js</code></p>
            \`;
            versionsDiv.appendChild(div);
        });
    </script>
</body>
</html>`;
        fs.writeFileSync('index.html', indexContent);

        // Commit and push to gh-pages
        this.runCommand('git add .', 'Staging all files');
        this.runCommand(`git commit -m "Release v${version} - Update GitHub Pages"`, 'Committing to gh-pages');
        this.runCommand('git push origin gh-pages', 'Pushing to gh-pages');

        // Go back to project root
        process.chdir('..');
        
        console.log(`📄 GitHub Pages updated with version ${version}`);
        console.log(`🌐 Your releases will be available at: https://[your-username].github.io/FxFilterJS/`);
    }

    // Main release function
    async release(type, skipChecks = false) {
        console.log(`🚀 Starting ${type} release...`);

        // Check git status unless skipping checks
        if (!skipChecks && !this.checkGitStatus()) {
            console.log('🛑 Please commit or stash your changes before releasing');
            process.exit(1);
        }

        // Get current version and calculate new version
        const currentVersion = this.getCurrentVersion();
        const newVersion = this.incrementVersion(currentVersion, type);

        console.log(`📈 Version: ${currentVersion} → ${newVersion}`);

        // Update package.json
        this.updatePackageVersion(newVersion);

        // Create git tag and push
        this.createGitTag(newVersion);

        // Create GitHub release
        this.createGitHubRelease(newVersion);

        // Update GitHub Pages
        this.updateGhPages(newVersion);

        console.log(`✅ Successfully released version ${newVersion}!`);
        console.log(`\n📋 Release Summary:`);
        console.log(`   • Version: ${newVersion}`);
        console.log(`   • Git tag: v${newVersion}`);
        console.log(`   • GitHub release: ✅`);
        console.log(`   • GitHub Pages: ✅`);
        console.log(`\n🌐 URLs:`);
        console.log(`   • Latest: https://[your-username].github.io/FxFilterJS/FxFilter.js`);
        console.log(`   • This version: https://[your-username].github.io/FxFilterJS/v${newVersion}/FxFilter.js`);
        console.log(`   • Versions registry: https://[your-username].github.io/FxFilterJS/versions.js`);
    }
}

// CLI handling
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    const skipChecks = args.includes('--skip-checks');

    if (!['major', 'minor', 'patch'].includes(command)) {
        console.log(`
🎨 FxFilter.js Release Manager

Usage:
  node release.js <type> [--skip-checks]

Types:
  major     Increment major version (1.0.0 → 2.0.0)
  minor     Increment minor version (1.0.0 → 1.1.0)
  patch     Increment patch version (1.0.0 → 1.0.1)

Options:
  --skip-checks    Skip git status checks

Examples:
  node release.js patch
  node release.js minor
  node release.js major --skip-checks
        `);
        process.exit(1);
    }

    const releaseManager = new ReleaseManager();
    releaseManager.release(command, skipChecks).catch(error => {
        console.error('❌ Release failed:', error.message);
        process.exit(1);
    });
}

module.exports = ReleaseManager;
