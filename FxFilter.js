class FxFilter {
    static elements = new WeakMap(); // Track elements and their state
    static filters = new Map(); // Registry for custom filters
    static filterOptions = new Map(); // Track filter options including updatesOn
    static running = false;

    static add(options) {
        // Support both old (name, callback) and new (options) format
        if (typeof options === 'string') {
            // Old format: add(name, callback)
            const name = arguments[0];
            const callback = arguments[1];
            this.filters.set(name, callback);
            this.filterOptions.set(name, { name, callback, updatesOn: [] });
            console.log(`🔧 Registered filter: "${name}"`);
        } else {
            // New format: add({name, callback, updatesOn})
            const { name, callback, updatesOn = [] } = options;
            this.filters.set(name, callback);
            this.filterOptions.set(name, { name, callback, updatesOn });
            console.log(`🔧 Registered filter: "${name}" with updatesOn: [${updatesOn.join(', ')}]`);
        }
    }

    static init() {
        console.log('🔄 FxFilter.init() called');

        // Register --fx-filter as a proper CSS custom property
        if ('CSS' in window && 'registerProperty' in CSS) {
            try {
                CSS.registerProperty({
                    name: '--fx-filter',
                    syntax: '*',
                    inherits: false,
                    initialValue: ''
                });
                console.log('✅ --fx-filter property registered');
            } catch (e) {
                console.log('⚠️ CSS registerProperty not supported or already registered');
            }
        }

        if (!this.running) {
            console.log('🚀 Starting FxFilter animation loop');
            this.running = true;
            this.tick();
        } else {
            console.log('⚡ FxFilter already running - skipping duplicate initialization');
        }
    }

    static tick() {
        this.scanElements();
        requestAnimationFrame(() => this.tick());
    }

    static scanElements() {
        // Scan only elements that could have --fx-filter (not our generated containers)
        document.querySelectorAll('*:not(.fx-container):not(svg)').forEach(element => {
            const fxFilter = this.getFxFilterValue(element);
            const storedState = this.elements.get(element);

            if (fxFilter) {
                // Get current styles for updatesOn tracking
                const currentStyles = this.getTrackedStyles(element, fxFilter);

                // Element has --fx-filter
                if (!storedState) {
                    // New element with fx-filter
                    this.addFxContainer(element, fxFilter);
                    this.elements.set(element, {
                        filter: fxFilter,
                        hasContainer: true,
                        trackedStyles: currentStyles
                    });
                } else if (storedState.filter !== fxFilter || this.stylesChanged(storedState.trackedStyles, currentStyles)) {
                    // Filter value changed OR tracked styles changed - remove old and add new
                    this.removeFxContainer(element);
                    this.addFxContainer(element, fxFilter);
                    this.elements.set(element, {
                        filter: fxFilter,
                        hasContainer: true,
                        trackedStyles: currentStyles
                    });
                }
                // If storedState exists and filter is same and styles unchanged, do nothing
            } else {
                // Element doesn't have --fx-filter
                if (storedState && storedState.hasContainer) {
                    this.removeFxContainer(element);
                    this.elements.delete(element);
                }
            }
        });
    }

    static getFxFilterValue(element) {
        const computed = getComputedStyle(element);
        return computed.getPropertyValue('--fx-filter').trim() || null;
    }

    static addFxContainer(element, filterValue) {
        // Skip if element already has fx-container
        if (element.querySelector('.fx-container')) {
            return;
        }

        // Parse filter value
        const { orderedFilters, customFilters } = this.parseFilterValue(filterValue);
        console.log('Parsed filters:', { orderedFilters, customFilters });

        // Build the combined filter list
        const filterParts = [];
        let svgContent = '';

        orderedFilters.forEach(item => {
            if (item.type === 'custom') {
                const filter = item.filter;
                const callback = this.filters.get(filter.name);

                if (callback) {
                    const filterId = `fx-${filter.name}-${Math.random().toString(36).substr(2, 6)}`;
                    const filterContent = callback(element, ...filter.params);

                    // Add SVG filter definition
                    svgContent += `<filter id="${filterId}"
                     x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"
                     >${filterContent}</filter>`;

                    // Add to filter parts
                    filterParts.push(`url(#${filterId})`);
                }
            } else if (item.type === 'css') {
                // Add CSS filter directly
                filterParts.push(item.filter);
            }
        });

        // Create the combined backdrop-filter value
        const backdropFilter = filterParts.join(' ');

        if (backdropFilter.trim()) {
            // Create the structure
            element.innerHTML += `
                <svg style="position: absolute; width: 0; height: 0;">
                    ${svgContent}
                </svg>
                <div class="fx-container" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; backdrop-filter: ${backdropFilter}; background: transparent; pointer-events: none; z-index: -1; overflow: hidden; border-radius: inherit;"></div>
            `;

            console.log('Applied combined filter:', backdropFilter);
            this.elements.set(element, { filter: filterValue, hasContainer: true });
        } else {
            console.log('No valid filters found');
        }
    }

    static createUnifiedSVG(customFilters) {
        console.log('createUnifiedSVG called with:', customFilters);

        const svg = document.createElement('svg');
        svg.style.cssText = 'position: absolute; width: 0; height: 0; pointer-events: none;';

        const filterIds = [];
        let svgContent = '';

        customFilters.forEach((filter, index) => {
            console.log('Processing filter:', filter.name, 'with params:', filter.params);
            const callback = this.filters.get(filter.name);
            console.log('Callback found:', !!callback);

            if (callback) {
                // Create unique ID for this filter instance
                const filterId = `fx-${filter.name}-${Math.random().toString(36).substr(2, 6)}`;
                filterIds.push(filterId);

                // Render filter content with callback, passing parameters as arguments
                const filterContent = callback(...filter.params);
                console.log('Filter content generated:', filterContent);
                svgContent += `<filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">${filterContent}</filter>`;
            }
        });

        console.log('Final SVG content:', svgContent);
        svg.innerHTML = svgContent;
        console.log('SVG element created:', svg);
        return { svg, filterIds };
    }


    static removeFxContainer(element) {
        element.querySelectorAll('.fx-container, svg').forEach(el => el.remove());
    }

    static parseFilterValue(filterValue) {
        // Parse: saturate(2) frosted-glass(8, 0.15) blur(10px)
        // Return: { orderedFilters: [...], customFilters: [...] }

        console.log('🔍 Parsing filter value:', filterValue);

        const orderedFilters = []; // Maintains original order
        const customFilters = [];

        // Regular expression to match filter functions with their parameters
        const filterRegex = /(\w+(?:-\w+)*)\s*\(([^)]*)\)/g;

        let match;
        while ((match = filterRegex.exec(filterValue)) !== null) {
            const filterName = match[1];
            const params = match[2];

            console.log(`📝 Found filter: ${filterName} with params: "${params}"`);

            if (this.filters.has(filterName)) {
                console.log(`✅ Custom filter "${filterName}" found in registry`);
                // It's a registered custom filter
                let paramArray = [];
                if (params.trim() !== '') {
                    paramArray = params.split(',').map(p => {
                        const trimmed = p.trim();
                        if (trimmed === '') return undefined;
                        const number = parseFloat(trimmed);
                        return !isNaN(number) ? number : trimmed;
                    }).filter(p => p !== undefined);
                }
                console.log(`📋 Parsed params for "${filterName}":`, paramArray);
                const customFilter = { name: filterName, params: paramArray };
                customFilters.push(customFilter);
                orderedFilters.push({ type: 'custom', filter: customFilter });
            } else {
                console.log(`🎨 CSS filter: ${filterName}(${params})`);
                // It's a native CSS filter
                orderedFilters.push({ type: 'css', filter: `${filterName}(${params})` });
            }
        }

        console.log('📊 Parse results:', { orderedFilters, customFilters });
        return {
            orderedFilters: orderedFilters,
            customFilters: customFilters
        };
    }

    static getTrackedStyles(element, filterValue) {
        const { customFilters } = this.parseFilterValue(filterValue);
        const trackedStyles = new Map();

        customFilters.forEach(filter => {
            const filterOptions = this.filterOptions.get(filter.name);
            if (filterOptions && filterOptions.updatesOn) {
                const computed = getComputedStyle(element);
                filterOptions.updatesOn.forEach(styleProp => {
                    const value = computed.getPropertyValue(styleProp);
                    trackedStyles.set(styleProp, value);
                });
            }
        });

        return trackedStyles;
    }

    static stylesChanged(oldStyles, newStyles) {
        if (!oldStyles || !newStyles) return true;
        if (oldStyles.size !== newStyles.size) return true;

        for (const [prop, value] of newStyles) {
            if (oldStyles.get(prop) !== value) {
                console.log(`🔄 Style change detected: ${prop} changed from "${oldStyles.get(prop)}" to "${value}"`);
                return true;
            }
        }

        return false;
    }
}
FxFilter.add({
    name: "noise",
    callback: (element, saturation = 0, intensity = 1, opacity = .25) => {
        // Create canvas for noise texture
        const canvas = document.createElement('canvas');
        canvas.width = element.clientWidth;
        canvas.height = element.clientHeight;
        const ctx = canvas.getContext('2d');

        // Disable smoothing for sharper noise
        ctx.imageSmoothingEnabled = false;

        // Generate additive noise pattern (bright)
        const imageDataAdd = ctx.createImageData(canvas.width, canvas.height);
        const dataAdd = imageDataAdd.data;
        const additiveIntensity = intensity;

        for (let i = 0; i < dataAdd.length; i += 4) {
            // Generate smooth random values between 0-1 for more unified noise
            const noiseValue1 = Math.random() * additiveIntensity * 255;
            const noiseValue2 = Math.random() * additiveIntensity * 255;
            const noiseValue3 = Math.random() * additiveIntensity * 255;

            // For saturation=0: use same value for all channels (grayscale)
            // For saturation=1: use different values for each channel (color)
            const baseNoise = noiseValue1; // Use first noise value as base for grayscale
            dataAdd[i] = baseNoise * (1 - saturation) + noiseValue1 * saturation;     // Red
            dataAdd[i + 1] = baseNoise * (1 - saturation) + noiseValue2 * saturation; // Green  
            dataAdd[i + 2] = baseNoise * (1 - saturation) + noiseValue3 * saturation; // Blue
            dataAdd[i + 3] = 255 * opacity; // Full opacity for unified appearance
        }

        ctx.putImageData(imageDataAdd, 0, 0);
        const noiseAdditiveURL = canvas.toDataURL();

        return `
                <feImage href="${noiseAdditiveURL}" result="noiseAdd" image-rendering="pixelated"/>
                <feBlend in="SourceGraphic" in2="noiseAdd" mode="overlay" image-rendering="pixelated" result="brightened"/>
                `;
    },
    updatesOn: ['width', 'height']  // No style dependencies for noise filter
});
FxFilter.add({
    name: "liquid-glass",
    callback: (element, refraction = 1, offset = 10) => {
        const width = element.offsetWidth;
        const height = element.offsetHeight;
        const refractionValue = parseFloat(refraction) / 2 || 0;
        const offsetValue = (parseFloat(offset) || 0) / 2;
        const borderRadius = parseFloat(window.getComputedStyle(element).borderRadius) || 0;

        // Create displacement map directly
        const maxDimension = Math.max(width, height);
        const imageData = new ImageData(maxDimension, maxDimension);
        const data = imageData.data;

        // Initialize with neutral gray (127 = no displacement)
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 127;     // R - X displacement channel
            data[i + 1] = 127; // G - unused channel
            data[i + 2] = 127; // B - Y displacement channel
            data[i + 3] = 255; // A
        }

        // Apply top edge displacement
        const topOffset = maxDimension / 2;
        for (let y = 0; y < topOffset; y++) {
            for (let x = 0; x < maxDimension; x++) {
                const gradientSegment = (topOffset - y) / topOffset; // bottom to top
                const pixelIndex = (y * maxDimension + x) * 4;
                const vyValue = 1 * refractionValue;
                data[pixelIndex + 2] = Math.max(0, Math.min(255, Math.round(127 + 127 * vyValue * Math.pow(gradientSegment, 1))));
            }
        }

        // Apply bottom edge displacement
        for (let y = maxDimension - topOffset; y < maxDimension; y++) {
            for (let x = 0; x < maxDimension; x++) {
                const gradientSegment = (y - (maxDimension - topOffset)) / topOffset; // top to bottom
                const pixelIndex = (y * maxDimension + x) * 4;
                const vyValue = -1 * refractionValue;
                data[pixelIndex + 2] = Math.max(0, Math.min(255, Math.round(127 + 127 * vyValue * Math.pow(gradientSegment, 1))));
            }
        }

        // Apply left edge displacement
        const leftOffset = maxDimension / 2;
        for (let y = 0; y < maxDimension; y++) {
            for (let x = 0; x < leftOffset; x++) {
                const gradientSegment = (leftOffset - x) / leftOffset; // right to left
                const pixelIndex = (y * maxDimension + x) * 4;
                const vxValue = 1 * refractionValue;
                data[pixelIndex] = Math.max(0, Math.min(255, Math.round(127 + 127 * vxValue * Math.pow(gradientSegment, 1))));
            }
        }

        // Apply right edge displacement
        for (let y = 0; y < maxDimension; y++) {
            for (let x = maxDimension - leftOffset; x < maxDimension; x++) {
                const gradientSegment = (x - (maxDimension - leftOffset)) / leftOffset; // left to right
                const pixelIndex = (y * maxDimension + x) * 4;
                const vxValue = -1 * refractionValue;
                data[pixelIndex] = Math.max(0, Math.min(255, Math.round(127 + 127 * vxValue * Math.pow(gradientSegment, 1))));
            }
        }

        // Create canvas and apply blur
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Center the displacement map on the canvas
        const offsetX = (maxDimension - width) / 2;
        const offsetY = (maxDimension - height) / 2;
        ctx.putImageData(imageData, -offsetX, -offsetY);

        // Apply border radius mask if needed
        if (borderRadius > 0) {
            const maskCanvas = new OffscreenCanvas(width, height);
            const maskCtx = maskCanvas.getContext('2d');
            maskCtx.fillStyle = "rgb(127, 127, 127)";
            maskCtx.beginPath();
            // Make mask smaller based on blur amount to prevent edge transparency
            const inset = offsetValue * 1; // Adjust multiplier as needed
            maskCtx.roundRect(inset, inset, width - (inset * 2), height - (inset * 2), Math.max(0, borderRadius - inset));
            maskCtx.clip();
            maskCtx.fillRect(0, 0, width, height);

            ctx.filter = `blur(${offsetValue}px)`;
            ctx.drawImage(maskCanvas, 0, 0, width, height);
        } else if (offsetValue > 0) {
            ctx.filter = `blur(${offsetValue}px)`;
            ctx.drawImage(canvas, 0, 0);
        }

        const dataURL = canvas.toDataURL();
        canvas.remove();

        return `
            <feImage result="FEIMG" href="${dataURL}" color-interpolation-filters="sRGB"/>
            <feDisplacementMap in="SourceGraphic" in2="FEIMG" scale="127" yChannelSelector="B" xChannelSelector="R" color-interpolation-filters="sRGB"/>
        `;
    },
    updatesOn: ['border-radius', 'width', 'height']
});
FxFilter.init()