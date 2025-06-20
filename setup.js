#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

class SetupManager {
    constructor() {
        this.packagePath = './package.json';
    }

    runCommand(command, description) {
        console.log(`🔄 ${description}`);
        try {
            const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
            return output.trim();
        } catch (error) {
            console.error(`❌ Failed: ${description}`);
            console.error(error.message);
            return null;
        }
    }

    checkPrerequisites() {
        console.log('🔍 Checking prerequisites...\n');
        
        let allGood = true;

        // Check Git
        const gitVersion = this.runCommand('git --version', 'Checking Git');
        if (gitVersion) {
            console.log(`✅ Git found: ${gitVersion}`);
        } else {
            console.log('❌ Git not found. Please install Git first.');
            allGood = false;
        }

        // Check GitHub CLI
        const ghVersion = this.runCommand('gh --version', 'Checking GitHub CLI');
        if (ghVersion) {
            console.log(`✅ GitHub CLI found: ${ghVersion.split('\n')[0]}`);
        } else {
            console.log('⚠️  GitHub CLI not found. Install with: brew install gh');
            console.log('   (Required for GitHub releases)');
        }

        // Check Node.js
        const nodeVersion = this.runCommand('node --version', 'Checking Node.js');
        if (nodeVersion) {
            console.log(`✅ Node.js found: ${nodeVersion}`);
        } else {
            console.log('❌ Node.js not found. Please install Node.js first.');
            allGood = false;
        }

        // Check if in git repo
        const gitStatus = this.runCommand('git status --porcelain', 'Checking Git repository');
        if (gitStatus !== null) {
            console.log('✅ Git repository detected');
        } else {
            console.log('❌ Not in a Git repository. Run: git init');
            allGood = false;
        }

        return allGood;
    }

    async setup() {
        console.log('🎨 FxFilter.js Release System Setup\n');

        // Check prerequisites
        const prereqsOk = this.checkPrerequisites();
        if (!prereqsOk) {
            console.log('\n❌ Please fix the issues above before continuing.');
            process.exit(1);
        }

        console.log('\n🔧 Setting up release system...\n');

        // Check if release.js exists
        if (!fs.existsSync('./release.js')) {
            console.log('❌ release.js not found. Please ensure you have the release script.');
            process.exit(1);
        }
        console.log('✅ Release script found');

        // Check if package.json has release scripts
        const packageJson = JSON.parse(fs.readFileSync(this.packagePath, 'utf8'));
        if (!packageJson.scripts || !packageJson.scripts['release:patch']) {
            console.log('⚠️  Package.json missing release scripts. Please add them manually.');
        } else {
            console.log('✅ Release scripts configured in package.json');
        }

        // Check GitHub authentication
        const ghAuth = this.runCommand('gh auth status', 'Checking GitHub authentication');
        if (ghAuth && ghAuth.includes('Logged in')) {
            console.log('✅ GitHub CLI authenticated');
        } else {
            console.log('⚠️  GitHub CLI not authenticated. Run: gh auth login');
        }

        // Get repository info
        const remoteUrl = this.runCommand('git remote get-url origin', 'Getting repository URL');
        if (remoteUrl) {
            console.log(`✅ Repository: ${remoteUrl}`);
            
            // Extract username/repo from URL
            const match = remoteUrl.match(/github\.com[\/:]([^\/]+)\/([^\/]+?)(?:\.git)?$/);
            if (match) {
                const [, username, repo] = match;
                console.log(`\n🌐 Your CDN URLs will be:`);
                console.log(`   • Latest: https://${username}.github.io/${repo}/FxFilter.js`);
                console.log(`   • Versioned: https://${username}.github.io/${repo}/v1.0.0/FxFilter.js`);
                console.log(`   • Registry: https://${username}.github.io/${repo}/versions.js`);
            }
        }

        console.log('\n📋 Next Steps:');
        console.log('1. Enable GitHub Pages in your repository settings');
        console.log('   • Go to Settings → Pages');
        console.log('   • Source: "Deploy from a branch"');
        console.log('   • Branch: "gh-pages" (will be created on first release)');
        console.log('2. If not authenticated, run: gh auth login');
        console.log('3. Make your first release: npm run release:patch');

        console.log('\n✅ Setup complete! You can now use the release system.');
        
        // Test release script
        console.log('\n🧪 Testing release script...');
        const testResult = this.runCommand('node release.js', 'Testing release script help');
        if (testResult && testResult.includes('FxFilter.js Release Manager')) {
            console.log('✅ Release script working correctly');
        } else {
            console.log('⚠️  Release script test failed');
        }
    }
}

// CLI handling
if (require.main === module) {
    const setupManager = new SetupManager();
    setupManager.setup().catch(error => {
        console.error('❌ Setup failed:', error.message);
        process.exit(1);
    });
}

module.exports = SetupManager;
