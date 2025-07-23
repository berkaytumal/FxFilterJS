import builtInEffects from "./src/effects";
import fxConsole from "./src/log";
class FxFilter {
    static elements = new WeakMap(); // Track elements and their state
    static filters = new Map(); // Registry for custom filters
    static filterOptions = new Map(); // Track filter options including updatesOn
    static running = false;

    static add(options) {
        // if options is a list of filters, register each one
        if (Array.isArray(options)) {
            options.forEach(filter => this.add(filter));
            return;
        }
        // Support both old (name, callback) and new (options) format
        if (typeof options === 'string') {
            // Old format: add(name, callback)
            const name = arguments[0];
            const callback = arguments[1];
            this.filters.set(name, callback);
            this.filterOptions.set(name, { name, callback, updatesOn: [] });
            fxConsole.log(`🔧 Registered filter: "${name}"`);
        } else {
            // New format: add({name, callback, updatesOn})
            const { name, callback, updatesOn = [] } = options;
            this.filters.set(name, callback);
            this.filterOptions.set(name, { name, callback, updatesOn });
            fxConsole.log(`🔧 Registered filter: "${name}" with updatesOn: [${updatesOn.join(', ')}]`);
        }
    }

    static init() {
        fxConsole.log('🔄 FxFilter.init() called');

        // Register --fx-filter as a proper CSS custom property
        if ('CSS' in window && 'registerProperty' in CSS) {
            try {
                CSS.registerProperty({
                    name: '--fx-filter',
                    syntax: '*',
                    inherits: false,
                    initialValue: ''
                });
                fxConsole.log('✅ --fx-filter property registered');
            } catch (e) {
                fxConsole.log('⚠️ CSS registerProperty not supported or already registered');
            }
        }

        if (!this.running) {
            fxConsole.log('🚀 Starting FxFilter animation loop');
            this.running = true;
            this.tick();
        } else {
            fxConsole.log('⚡ FxFilter already running - skipping duplicate initialization');
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
                let parsedFilter;
                if (storedState && storedState.filter === fxFilter && storedState.parsedFilter) {
                    parsedFilter = storedState.parsedFilter;
                } else {
                    parsedFilter = this.parseFilterValue(fxFilter);
                }
                const currentStyles = this.getTrackedStyles(element, fxFilter, parsedFilter);

                if (!storedState) {
                    // New element: create container and persistent filterId
                    const filterId = `fx-${Math.random().toString(36).substr(2, 8)}`;
                    this.addFxContainer(element, fxFilter, parsedFilter, filterId);
                    this.elements.set(element, {
                        filter: fxFilter,
                        hasContainer: true,
                        trackedStyles: currentStyles,
                        parsedFilter: parsedFilter,
                        filterId
                    });
                } else if (storedState.filter !== fxFilter || this.stylesChanged(storedState.trackedStyles, currentStyles)) {
                    // Only update SVG filter and CSS filter reference, not container
                    this.updateFxFilter(element, fxFilter, parsedFilter, storedState.filterId);
                    this.elements.set(element, {
                        filter: fxFilter,
                        hasContainer: true,
                        trackedStyles: currentStyles,
                        parsedFilter: parsedFilter,
                        filterId: storedState.filterId
                    });
                }
                // If storedState exists and filter is same and styles unchanged, do nothing
            } else {
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

    static addFxContainer(element, filterValue, parsedFilter) {
        // Skip if element already has fx-container
        if (element.querySelector('.fx-container')) {
            return;
        }

        const { orderedFilters, customFilters } = parsedFilter || this.parseFilterValue(filterValue);
        fxConsole.log('Parsed filters:', { orderedFilters, customFilters });

        // Use provided filterId for persistent reference
        let filterId = arguments[3];
        if (!filterId) {
            filterId = `fx-${Math.random().toString(36).substr(2, 8)}`;
        }

        // Build the combined filter list
        const filterParts = [];
        let svgContent = '';

        orderedFilters.forEach(item => {
            if (item.type === 'custom') {
                const filter = item.filter;
                const callback = this.filters.get(filter.name);
                if (callback) {
                    const filterContent = callback(element, ...filter.params);
                    svgContent += `<filter id="${filterId}"
                     x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"
                     >${filterContent}</filter>`;
                    filterParts.push(`url(#${filterId})`);
                }
            } else if (item.type === 'css') {
                filterParts.push(item.filter);
            }
        });

        const backdropFilter = filterParts.join(' ');

        if (backdropFilter.trim()) {
            element.innerHTML += `
                <div class="fx-container" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; backdrop-filter: ${backdropFilter}; background: transparent; pointer-events: none; z-index: -1; overflow: hidden; border-radius: inherit;">
                    <svg style="position: absolute; width: 0; height: 0;">
                        ${svgContent}
                    </svg>
                </div>
            `;
            fxConsole.log('Applied combined filter:', backdropFilter);
        } else {
            fxConsole.log('No valid filters found');
        }
    }

    // Update SVG filter and CSS filter reference in-place
    static updateFxFilter(element, filterValue, parsedFilter, filterId) {
        const { orderedFilters, customFilters } = parsedFilter || this.parseFilterValue(filterValue);
        fxConsole.log('Updating filter:', { orderedFilters, customFilters });
        const filterParts = [];
        let svgContent = '';
        orderedFilters.forEach(item => {
            if (item.type === 'custom') {
                const filter = item.filter;
                const callback = this.filters.get(filter.name);
                if (callback) {
                    const filterContent = callback(element, ...filter.params);
                    svgContent += `<filter id="${filterId}"
                     x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"
                     >${filterContent}</filter>`;
                    filterParts.push(`url(#${filterId})`);
                }
            } else if (item.type === 'css') {
                filterParts.push(item.filter);
            }
        });
        const backdropFilter = filterParts.join(' ');
        // Update SVG content
        const svg = element.querySelector('.fx-container svg');
        if (svg) {
            svg.innerHTML = svgContent;
        }
        // Update backdrop-filter style
        const container = element.querySelector('.fx-container');
        if (container) {
            container.style.backdropFilter = backdropFilter;
        }
        fxConsole.log('Updated combined filter:', backdropFilter);
    }

    static createUnifiedSVG(customFilters) {
        fxConsole.log('createUnifiedSVG called with:', customFilters);

        const svg = document.createElement('svg');
        svg.style.cssText = 'position: absolute; width: 0; height: 0; pointer-events: none;';

        const filterIds = [];
        let svgContent = '';

        customFilters.forEach((filter, index) => {
            fxConsole.log('Processing filter:', filter.name, 'with params:', filter.params);
            const callback = this.filters.get(filter.name);
            fxConsole.log('Callback found:', !!callback);

            if (callback) {
                // Create unique ID for this filter instance
                const filterId = `fx-${filter.name}-${Math.random().toString(36).substr(2, 6)}`;
                filterIds.push(filterId);

                // Render filter content with callback, passing parameters as arguments
                const filterContent = callback(...filter.params);
                fxConsole.log('Filter content generated:', filterContent);
                svgContent += `<filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">${filterContent}</filter>`;
            }
        });

        fxConsole.log('Final SVG content:', svgContent);
        svg.innerHTML = svgContent;
        fxConsole.log('SVG element created:', svg);
        return { svg, filterIds };
    }


    static removeFxContainer(element) {
        element.querySelectorAll('.fx-container, svg').forEach(el => el.remove());
    }

    static parseFilterValue(filterValue) {
        // Parse: saturate(2) frosted-glass(8, 0.15) blur(10px)
        // Return: { orderedFilters: [...], customFilters: [...] }

        fxConsole.log('🔍 Parsing filter value:', filterValue);

        const orderedFilters = []; // Maintains original order
        const customFilters = [];

        // Regular expression to match filter functions with their parameters
        const filterRegex = /(\w+(?:-\w+)*)\s*\(([^)]*)\)/g;

        let match;
        while ((match = filterRegex.exec(filterValue)) !== null) {
            const filterName = match[1];
            const params = match[2];

            fxConsole.log(`📝 Found filter: ${filterName} with params: "${params}"`);

            if (this.filters.has(filterName)) {
                fxConsole.log(`✅ Custom filter "${filterName}" found in registry`);
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
                fxConsole.log(`📋 Parsed params for "${filterName}":`, paramArray);
                const customFilter = { name: filterName, params: paramArray };
                customFilters.push(customFilter);
                orderedFilters.push({ type: 'custom', filter: customFilter });
            } else {
                fxConsole.log(`🎨 CSS filter: ${filterName}(${params})`);
                // It's a native CSS filter
                orderedFilters.push({ type: 'css', filter: `${filterName}(${params})` });
            }
        }

        fxConsole.log('📊 Parse results:', { orderedFilters, customFilters });
        return {
            orderedFilters: orderedFilters,
            customFilters: customFilters
        };
    }

    static getTrackedStyles(element, filterValue, parsedFilter) {
        const { customFilters } = parsedFilter || this.parseFilterValue(filterValue);
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
                fxConsole.log(`🔄 Style change detected: ${prop} changed from "${oldStyles.get(prop)}" to "${value}"`);
                return true;
            }
        }

        return false;
    }
}
FxFilter.add(builtInEffects);
FxFilter.init()