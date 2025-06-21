#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE = require('./package.json');
const VERSION = PACKAGE.version;
const REPO_URL = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
const BRANCH = 'gh-pages';
const WWW_DIR = 'www';
const TMP_DIR = '.gh-pages-tmp';
const FXFILTER = 'FxFilter.js';

function run(cmd, desc) {
  console.log('> ' + desc);
  execSync(cmd, { stdio: 'inherit' });
}

function cleanTmp() {
  if (fs.existsSync(TMP_DIR)) {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  }
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const file of fs.readdirSync(src)) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    if (fs.lstatSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  cleanTmp();
  // Clone only the gh-pages branch
  run(`git clone --branch ${BRANCH} --single-branch ${REPO_URL} ${TMP_DIR}`, 'Clone gh-pages branch');
  // Only update/add new files, do not delete previous versions
  copyRecursive(WWW_DIR, TMP_DIR);
  fs.copyFileSync(FXFILTER, path.join(TMP_DIR, FXFILTER));
  const versionDir = path.join(TMP_DIR, 'v' + VERSION);
  fs.mkdirSync(versionDir, { recursive: true });
  fs.copyFileSync(FXFILTER, path.join(versionDir, FXFILTER));
  // Commit and push
  process.chdir(TMP_DIR);
  run('git add .', 'Stage all files');
  run(`git commit -m "Deploy v${VERSION} to GitHub Pages" || echo "Nothing to commit"`, 'Commit changes');
  run(`git push origin ${BRANCH}`, 'Push to gh-pages');
  process.chdir('..');
  cleanTmp();
  console.log('✅ Deployed to GitHub Pages! Previous versions are preserved.');
}

main();
