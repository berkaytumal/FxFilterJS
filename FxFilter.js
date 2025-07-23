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
                // Use cached parsedFilter if filter value hasn't changed
                let parsedFilter;
                if (storedState && storedState.filter === fxFilter && storedState.parsedFilter) {
                    parsedFilter = storedState.parsedFilter;
                } else {
                    parsedFilter = this.parseFilterValue(fxFilter);
                }

                // Get current styles for updatesOn tracking
                const currentStyles = this.getTrackedStyles(element, fxFilter, parsedFilter);

                // Element has --fx-filter
                if (!storedState) {
                    // New element with fx-filter
                    this.addFxContainer(element, fxFilter, parsedFilter);
                    this.elements.set(element, {
                        filter: fxFilter,
                        hasContainer: true,
                        trackedStyles: currentStyles,
                        parsedFilter: parsedFilter
                    });
                } else if (storedState.filter !== fxFilter || this.stylesChanged(storedState.trackedStyles, currentStyles)) {
                    // Filter value changed OR tracked styles changed - remove old and add new
                    this.removeFxContainer(element);
                    this.addFxContainer(element, fxFilter, parsedFilter);
                    this.elements.set(element, {
                        filter: fxFilter,
                        hasContainer: true,
                        trackedStyles: currentStyles,
                        parsedFilter: parsedFilter
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

    static addFxContainer(element, filterValue, parsedFilter) {
        // Skip if element already has fx-container
        if (element.querySelector('.fx-container')) {
            return;
        }

        // Parse filter value (use cached if provided)
        const { orderedFilters, customFilters } = parsedFilter || this.parseFilterValue(filterValue);
        fxConsole.log('Parsed filters:', { orderedFilters, customFilters });

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
                <div class="fx-container" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; backdrop-filter: ${backdropFilter}; background: transparent; pointer-events: none; z-index: -1; overflow: hidden; border-radius: inherit;">
                    <svg style="position: absolute; width: 0; height: 0;">
                        
                    </svg>
                </div>
            `;
            element.querySelector('.fx-container svg').innerHTML = svgContent;
            fxConsole.log('Applied combined filter:', backdropFilter);
            this.elements.set(element, { filter: filterValue, hasContainer: true });
        } else {
            fxConsole.log('No valid filters found');
        }
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