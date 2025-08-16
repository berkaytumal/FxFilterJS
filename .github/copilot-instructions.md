# FxFilterJS - JavaScript Visual Effects Library

FxFilterJS is a JavaScript library for creating advanced visual effects like liquid glass, frosted glass, chromatic aberration, and noise patterns using SVG filters and canvas-based textures. It provides CSS custom properties for applying effects declaratively.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap and Build (FAST - No Long Timeouts Needed)
- `npm install` -- installs dependencies instantly (no dependencies in package.json)  
- `npm run build` -- builds dist/FxFilter.js in ~90ms using Rollup (set timeout to 120s max)
- `npm run build:watch` -- builds and watches for changes using Rollup watch mode

### Development Server and Live Coding
- `npm run start` -- starts live-server on http://127.0.0.1:8080 for development (takes ~15s to start)
- `npm run dev` -- runs both build:watch and live-server concurrently with auto-reload (recommended for development)
- Open http://127.0.0.1:8080 in browser to see the demo page with all glass effects

### Project Structure Navigation
- **Main library**: `FxFilter.js` - main library file that imports from src/
- **Built output**: `dist/FxFilter.js` - bundled file created by Rollup
- **Source code**: `src/` directory contains:
  - `effects.js` - exports all built-in effects
  - `log.js` - debug logging utilities
  - `effects/` - individual effect implementations (noise.js, liquid-glass.js, etc.)
- **Demo page**: `index.html` - showcases all effects with live examples
- **Release script**: `release.js` - deploys to GitHub Pages with versioning

## Validation Scenarios (CRITICAL - Always Test These)

### After Making ANY Changes to Effects or Core Library:
1. **Build the library**: `npm run build` (should complete in <90ms)
2. **Start dev server**: `npm run start` 
3. **Open browser**: Navigate to http://127.0.0.1:8080
4. **Verify all effects work**: Scroll through the demo page and confirm all glass effect cards display properly:
   - Noise effects (Raw, Dark, Light variations)  
   - Liquid glass effects (Raw, Dark, Light, Chroma variations)
   - Scale effects (scale(.5), scale(2), scale(0))
5. **Test scrolling**: Use PageDown/PageUp to test effects against the fixed background
6. **Check console**: Look for any JavaScript errors in browser developer tools

### Testing Custom Effects:
1. Add your effect to `src/effects/` directory
2. Import and export it in `src/effects.js`
3. Add a demo card to `index.html` using the effect
4. Run `npm run dev` and verify the effect renders correctly
5. Test with different parameters to ensure robustness

## Common Development Tasks

### Adding a New Visual Effect:
1. Create `src/effects/your-effect.js` following the pattern:
```javascript
export default {
    name: "your-effect",
    callback: (element, param1 = defaultValue, param2 = defaultValue) => {
        // Return SVG filter string
        return `<feGaussianBlur stdDeviation="${param1}"/>`;
    },
    updatesOn: ['width', 'height'] // Optional: when to re-render
}
```
2. Add to `src/effects.js` imports and exports
3. Build with `npm run build`
4. Test in browser with demo page

### Using Effects in HTML:
```css
.element {
    --fx-filter: blur(10px) noise(.25, 1, .1);
}
.liquid-glass {
    --fx-filter: blur(2px) contrast(1.2) liquid-glass(2, 10) saturate(1.2);
}
```

### Deployment to GitHub Pages:
- `node release.js` -- **CURRENTLY BROKEN**: fails with ES module error due to package.json "type": "module"
- The script uses CommonJS require() syntax but needs ES imports
- Creates versioned deployment at `/v{version}/FxFilter.js` 
- Preserves all previous versions

## Build System Details

### Dependencies and Tools:
- **Build tool**: Rollup (installed via npx, no global installation needed)
- **Dev server**: live-server (installed via npx, serves on port 8080)
- **Process management**: concurrently (runs build:watch + live-server together)
- **No testing framework**: Repository has no unit tests or testing infrastructure
- **No linting**: No ESLint, Prettier, or other code quality tools configured
- **No CI/CD**: No GitHub Actions or other automated workflows

### Build Performance:
- npm install: Instant (no dependencies)
- npm run build: ~90ms (very fast)
- npm run start: ~15s (installing live-server via npx)
- npm run dev: ~20s (installing concurrently + live-server via npx)

## Troubleshooting

### Build Issues:
- If build fails, check that all imports in `src/effects.js` match actual files
- Rollup will show clear error messages for missing imports or syntax errors

### Development Server Issues:
- If port 8080 is in use, live-server will automatically try alternative ports
- Check console for the actual URL and port being used

### Effect Not Working:
- Verify effect is properly exported in `src/effects.js`
- Check browser console for SVG filter errors
- Ensure CSS custom property `--fx-filter` is applied to element
- Test with simple effects first (blur, scale) before complex ones

### Release Script Issues:
- `release.js` currently broken due to ES modules vs CommonJS mismatch
- Error: "require is not defined in ES module scope"
- To fix: convert `release.js` to use ES imports or rename to `release.cjs`

### Common Console Errors to Ignore:
- `IndexSizeError: Failed to execute 'createImageData'` - occurs with zero-sized elements, harmless
- `Failed to load resource: net::ERR_BLOCKED_BY_CLIENT` - external image blocked by adblocker, harmless

## Repository Insights

### Key Files to Know:
```
├── FxFilter.js              # Main library (imports from src/)
├── src/
│   ├── effects.js           # Central registry of all effects  
│   ├── log.js              # Debug logging utilities
│   └── effects/            # Individual effect implementations
│       ├── noise.js        # Noise texture generation
│       ├── liquid-glass.js # iOS-style liquid glass effect
│       ├── scale.js        # Scaling/zoom effects
│       ├── scale2.js       # Alternative scaling implementation
│       └── color-overlay.js # Color overlay effects
├── dist/FxFilter.js        # Built bundle (created by npm run build)
├── index.html              # Demo page showcasing all effects
├── package.json            # NPM scripts and metadata
├── rollup.config.js        # Rollup build configuration
└── release.js              # GitHub Pages deployment script
```

### Effect Development Patterns:
- Effects return SVG filter primitive strings
- Use `updatesOn` array to specify when effects should re-render (e.g., on resize)
- Canvas-based effects (like noise) generate data URLs for textures
- Complex effects chain multiple SVG primitives together

Always test your changes with the live demo page - it's the best way to ensure effects work correctly across different scenarios and parameters.