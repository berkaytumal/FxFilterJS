class FxFilter {
    static elements = new WeakMap(); // Track elements and their state
    static filters = new Map(); // Registry for custom filters
    static running = false;

    static add(name, callback) {
        this.filters.set(name, callback);
        console.log(`🔧 Registered filter: "${name}"`);
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
                // Element has --fx-filter
                if (!storedState) {
                    // New element with fx-filter
                    this.addFxContainer(element, fxFilter);
                    this.elements.set(element, { filter: fxFilter, hasContainer: true });
                } else if (storedState.filter !== fxFilter) {
                    // Filter value changed - remove old and add new
                    this.removeFxContainer(element);
                    this.addFxContainer(element, fxFilter);
                    this.elements.set(element, { filter: fxFilter, hasContainer: true });
                }
                // If storedState exists and filter is same, do nothing
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
}
FxFilter.add("noise", (element, saturation = 0, intensity = 1, opacity = .25) => {
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
});
FxFilter.add("liquid-glass", (element, refraction = 1, offset = 10) => {
    class RefractionEditor {
        imageData = null;
        constructor(width, height, radius) {
            this.imageData = new ImageData(width, height);
            this.width = width;
            this.height = height;
            this.radius = radius;
            //make all pixels solid with channel separation
            for (let i = 0; i < this.imageData.data.length; i += 4) {
                const base = 127; // Empirically determined neutral value for sRGB color space
                this.imageData.data[i] = base;     // R - X displacement channel
                this.imageData.data[i + 1] = base; // G - unused channel
                this.imageData.data[i + 2] = base; // B - Y displacement channel
                this.imageData.data[i + 3] = 255; // A
            }
        }
        static linearToSRGB(x) {
            return x <= 0.0031308
                ? 12.92 * x
                : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
        }

        static sRGBToLinear(x) {
            return x <= 0.04045
                ? x / 12.92
                : Math.pow((x + 0.055) / 1.055, 2.4);
        }

        static fromLinearImageData(linearImageData) {
            const { width, height, data } = linearImageData;
            const output = new Uint8ClampedArray(data.length);

            for (let i = 0; i < data.length; i += 4) {
                for (let j = 0; j < 3; j++) {
                    const lin = data[i + j] / 255;
                    output[i + j] = Math.round(this.linearToSRGB(lin) * 255);
                }
                output[i + 3] = data[i + 3]; // alpha
            }

            return new ImageData(output, width, height);
        }

        static toLinearImageData(srgbImageData) {
            const { width, height, data } = srgbImageData;
            const output = new Uint8ClampedArray(data.length);

            for (let i = 0; i < data.length; i += 4) {
                for (let j = 0; j < 3; j++) {
                    const s = data[i + j] / 255;
                    output[i + j] = Math.round(this.sRGBToLinear(s) * 255);
                }
                output[i + 3] = data[i + 3]; // alpha
            }

            return new ImageData(output, width, height);
        }
        addTransformation(vx, vy, direction, dx, dy, dw, dh, easing = (x) => x) {
            const data = this.imageData.data;

            // Iterate through each pixel in the rectangle
            for (let y = dy; y < dy + dh; y++) {
                for (let x = dx; x < dx + dw; x++) {
                    // Skip if outside image bounds
                    if (x < 0 || y < 0 || x >= this.imageData.width || y >= this.imageData.height) continue;

                    // Calculate gradient segment based on direction
                    let gradientSegment = 0;
                    switch (direction.toLowerCase()) {
                        case 'down':
                            gradientSegment = (y - dy) / dh; // top to bottom
                            break;
                        case 'up':
                        case 'top':
                            gradientSegment = (dh - (y - dy)) / dh; // bottom to top
                            break;
                        case 'right':
                            gradientSegment = (x - dx) / dw; // left to right
                            break;
                        case 'left':
                            gradientSegment = (dw - (x - dx)) / dw; // right to left
                            break;
                        default:
                            gradientSegment = (y - dy) / dh; // default to down
                    }

                    // Clamp gradient segment to 0-1 range
                    gradientSegment = Math.max(0, Math.min(1, gradientSegment));

                    // Calculate pixel index
                    const pixelIndex = (y * this.imageData.width + x) * 4;

                    // Get current R and B values (X and Y displacement channels)
                    let r = data[pixelIndex];     // R channel for X displacement
                    let b = data[pixelIndex + 2]; // B channel for Y displacement

                    // Calculate vx and vy values using functions
                    var vxValue = typeof vx === 'function' ? vx(x, y, dw, dh) : vx;
                    var vyValue = typeof vy === 'function' ? vy(x, y, dw, dh) : vy;
                    // vxValue -= vyValue * .125

                    // Apply transformation to specific channels
                    r += 127 * vxValue * easing(gradientSegment); // X displacement goes to R channel
                    b += 127 * vyValue * easing(gradientSegment); // Y displacement goes to B channel

                    // Clamp values to 0-255 range and update only the channels we're using
                    this.imageData.data[pixelIndex] = Math.max(0, Math.min(255, Math.round(r)));     // R channel
                    this.imageData.data[pixelIndex + 2] = Math.max(0, Math.min(255, Math.round(b))); // B channel
                    // Leave G channel (index 1) and A channel (index 3) unchanged
                }
            }
        }
        /**
         * Compute the local normal and border distance for a given pixel (x, y)
         * Returns: { nx, ny, distToBorder, isCorner }
         */
        getBorderNormalAndDistance(x, y) {
            const w = this.width;
            const h = this.height;
            const r = Math.max(0, Math.min(this.radius, Math.min(w, h) / 2));
            // Clamp radius to valid range
            // Determine which corner (if any) the pixel is in
            let isCorner = false;
            let cx = 0, cy = 0;
            // Top-left
            if (x < r && y < r) {
                isCorner = true;
                cx = r;
                cy = r;
            }
            // Top-right
            else if (x >= w - r && y < r) {
                isCorner = true;
                cx = w - r - 1;
                cy = r;
            }
            // Bottom-left
            else if (x < r && y >= h - r) {
                isCorner = true;
                cx = r;
                cy = h - r - 1;
            }
            // Bottom-right
            else if (x >= w - r && y >= h - r) {
                isCorner = true;
                cx = w - r - 1;
                cy = h - r - 1;
            }
            if (isCorner) {
                // Vector from center of corner circle to pixel
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                // Normalized normal vector (pointing outward)
                let nx = dx / (dist || 1);
                let ny = dy / (dist || 1);
                // Distance to border: how far from the arc
                const distToBorder = r - dist;
                return { nx, ny, distToBorder, isCorner: true };
            } else {
                // Not in a corner: find closest edge
                // For each edge, compute distance and normal
                // Top edge
                if (y < r) {
                    return { nx: 0, ny: -1, distToBorder: y, isCorner: false };
                }
                // Bottom edge
                if (y >= h - r) {
                    return { nx: 0, ny: 1, distToBorder: h - 1 - y, isCorner: false };
                }
                // Left edge
                if (x < r) {
                    return { nx: -1, ny: 0, distToBorder: x, isCorner: false };
                }
                // Right edge
                if (x >= w - r) {
                    return { nx: 1, ny: 0, distToBorder: w - 1 - x, isCorner: false };
                }
                // Center region: no border effect
                // Find min distance to any edge
                const minDist = Math.min(x, y, w - 1 - x, h - 1 - y);
                // Default normal: up
                return { nx: 0, ny: 0, distToBorder: minDist, isCorner: false };
            }
        }

        /**
         * Apply a border-radius-aware refraction transformation to the whole image
         * @param {number} refractionStrength - max refraction at border
         * @param {number} borderWidth - width of the border region (in px) where refraction is applied
         * @param {function} [falloff] - optional function for falloff (default: quadratic)
         */
        applyBorderRadiusRefraction(refractionStrength, borderWidth, falloff) {
            const data = this.imageData.data;
            const w = this.width;
            const h = this.height;
            const r = Math.max(0, Math.min(this.radius, Math.min(w, h) / 2));
            if (!falloff) {
                // Quadratic falloff by default
                falloff = (d) => d * d;
            }
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const { nx, ny, distToBorder } = this.getBorderNormalAndDistance(x, y);
                    // Only apply if within borderWidth from the border (arc or edge)
                    let borderDist = Math.max(0, Math.min(borderWidth, distToBorder));
                    let t = 1 - borderDist / (borderWidth || 1); // 1 at border, 0 at inner edge
                    t = Math.max(0, Math.min(1, t));
                    t = falloff(t);
                    // Compute displacement
                    const dx = nx * refractionStrength * t;
                    const dy = ny * refractionStrength * t;
                    // Write to R/B channels
                    const pixelIndex = (y * w + x) * 4;
                    let rVal = data[pixelIndex];
                    let bVal = data[pixelIndex + 2];
                    // Center value is 127, so add displacement scaled to [-127,127]
                    rVal += 127 * dx;
                    bVal += 127 * dy;
                    data[pixelIndex] = Math.max(0, Math.min(255, Math.round(rVal)));
                    data[pixelIndex + 2] = Math.max(0, Math.min(255, Math.round(bVal)));
                }
            }
        }
        getImageData() {
            return this.imageData;
        }
    }
    // --- Glass Refraction SVG Filter ---
    function calculateRefractionMap(refraction, width, height, radius) {
        refraction /= 2;
        const refractionEditor = new RefractionEditor(width, height, radius);
        console.log("calculateRefractionMap", refraction, width, height, radius);
        // Use the new border-radius-aware refraction for the border region
        // The borderWidth is offset (how far the effect should reach inwards)
        // The refractionStrength is refraction (max at border)
        //refractionEditor.applyBorderRadiusRefraction(refraction, offset, (t) => t * t); // quadratic falloff
        console.log("refractionEditor", refraction);
        var offset = height / 2
        refractionEditor.addTransformation(0, 1 * refraction, 'top', 0, 0, width, offset, (x) => Math.pow(x, 1));
        refractionEditor.addTransformation(0, -1 * refraction, 'bottom', 0, height - offset, width, offset, (x) => Math.pow(x, 1));
        //now left and rigght
        offset = width / 2;
        refractionEditor.addTransformation(1 * refraction, 0, 'left', 0, 0, offset, height, (x) => Math.pow(x, 1));
        refractionEditor.addTransformation(-1 * refraction, 0, 'right', width - offset, 0, offset, height, (x) => Math.pow(x, 1));


        return refractionEditor.getImageData();
    }


    function createGlassSVGFilter(el, refraction, offset) {
        const width = el.offsetWidth;
        const height = el.offsetHeight;
        // Use a stable ID based on element and size to avoid regenerating filters unnecessarily
        // calculateRefractionMap now returns ImageData, so we need to convert it to a blob URL
        // Get refraction and offset from element's CSS variables
        const refractionValue = parseFloat(refraction) || 0;
        var offsetValue = parseFloat(offset) || 0;
        var borderRadius = parseFloat(window.getComputedStyle(el).borderRadius) || 0;
        const imageData = calculateRefractionMap(refractionValue, width, height, borderRadius);
        // Convert ImageData to Blob with canvasto blob
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        //canvas color space is srgb


        ctx.putImageData(imageData, 0, 0);
        ctx.fillStyle = "rgb(127, 127, 127)"; // Neutral gray for refraction
        // Fill the canvas with neutral gray for proper mask
        // Apply border radius if specified
        const canvas2 = new OffscreenCanvas(width, height);
        canvas2.width = width;
        canvas2.height = height;
        const ctx2 = canvas2.getContext('2d');
        ctx2.fillStyle = "rgb(127, 127, 127)"; //
        if (borderRadius > 0) {
            ctx2.beginPath();
            ctx2.roundRect(0, 0, width, height, borderRadius);
            ctx2.clip();
        }
        ctx2.fillRect(0, 0, width, height);

        ctx.filter = `blur(${offsetValue}px)`
        ctx.drawImage(canvas2, 0, 0, width, height);

        const dataURL = canvas.toDataURL();
        console.log('Generated glass filter data URL:', dataURL);

        console.log("width", width, "height", height, "refraction", refractionValue, "offset", offsetValue, "borderRadius", borderRadius);
        canvas.remove(); // Clean up canvas

        const svgString =
            // <filter id="${filterId}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
            `
        <feImage result="FEIMG" href="${dataURL}" color-interpolation-filters="sRGB"/>
                <feDisplacementMap in="SourceGraphic" in2="FEIMG" scale="127" yChannelSelector="B" xChannelSelector="R" color-interpolation-filters="sRGB"/>

    `;
        return svgString
    }
    return createGlassSVGFilter(element, refraction, offset);

})
FxFilter.init()