import builtInEffects from "./src/effects";
import fxConsole from "./src/log";
class FxFilter {
    static elements = new WeakMap(); // Track elements and their state
    static filters = new Map(); // Registry for custom filters
    static filterOptions = new Map(); // Track filter options including updatesOn
    static running = false;
    static observer = null; // MutationObserver instance
    static resizeObserver = null; // ResizeObserver instance
    static pendingElements = new Set(); // Elements waiting for proper dimensions

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
                    syntax: '<filter-function># | none',
                    inherits: false,
                    initialValue: ''
                });
                fxConsole.log('✅ --fx-filter property registered');
            } catch (e) {
                fxConsole.log('⚠️ CSS registerProperty not supported or already registered');
            }
        }

        if (!this.running) {
            fxConsole.log('🚀 Starting FxFilter with MutationObserver');
            this.running = true;
            
            // Wait for DOM to be ready before initial scan
            this.waitForDOMReady(() => {
                this.setupMutationObserver();
                this.setupResizeObserver();
                this.scanElements(); // Initial scan for existing elements
                fxConsole.log('🎯 Initial DOM scan completed');
            });
        } else {
            fxConsole.log('⚡ FxFilter already running - skipping duplicate initialization');
        }
    }

    static waitForDOMReady(callback) {
        if (document.readyState === 'loading') {
            // DOM is still loading, wait for DOMContentLoaded
            document.addEventListener('DOMContentLoaded', () => {
                // Give a small delay to ensure layout calculations are done
                setTimeout(callback, 50);
            });
        } else {
            // DOM is already ready, execute immediately
            setTimeout(callback, 50);
        }
    }

    static setupResizeObserver() {
        if ('ResizeObserver' in window) {
            this.resizeObserver = new ResizeObserver((entries) => {
                const elementsToCheck = new Set();
                
                entries.forEach(entry => {
                    const element = entry.target;
                    
                    // Check if this element had zero dimensions before and now has dimensions
                    if (this.pendingElements.has(element)) {
                        const rect = element.getBoundingClientRect();
                        const clientWidth = element.clientWidth || 0;
                        const clientHeight = element.clientHeight || 0;
                        const offsetWidth = element.offsetWidth || 0;
                        const offsetHeight = element.offsetHeight || 0;
                        
                        // Element now has valid dimensions if all methods report positive values
                        const hasValidDimensions = (
                            rect.width > 0 && rect.height > 0 &&
                            (clientWidth > 0 || offsetWidth > 0) &&
                            (clientHeight > 0 || offsetHeight > 0)
                        );
                        
                        if (hasValidDimensions) {
                            fxConsole.log('📏 Element now has valid dimensions, processing:', element);
                            this.pendingElements.delete(element);
                            elementsToCheck.add(element);
                        }
                    }
                    
                    // Also check if this element needs updates based on size changes
                    const storedState = this.elements.get(element);
                    if (storedState && storedState.filter) {
                        elementsToCheck.add(element);
                    }
                });
                
                if (elementsToCheck.size > 0) {
                    this.scanSpecificElements(Array.from(elementsToCheck));
                }
            });
            
            fxConsole.log('📏 ResizeObserver setup complete');
        } else {
            fxConsole.log('⚠️ ResizeObserver not supported');
        }
    }

    static setupMutationObserver() {
        // Create MutationObserver to watch for DOM changes
        this.observer = new MutationObserver((mutations) => {
            this.handleMutations(mutations);
        });

        // Start observing document.body for changes
        this.observer.observe(document.body, {
            childList: true,    // Watch for added/removed nodes
            subtree: true,      // Watch entire subtree 
            attributes: true,   // Watch for attribute changes
            attributeFilter: ['style', 'class'] // Only watch style and class changes
        });

        fxConsole.log('👁️ MutationObserver setup complete');
    }

    static handleMutations(mutations) {
        const elementsToCheck = new Set();

        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                // Handle added nodes
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Add the element itself
                        elementsToCheck.add(node);
                        // Add all descendants that could have --fx-filter
                        node.querySelectorAll('*:not(.fx-container):not(svg)').forEach(el => {
                            elementsToCheck.add(el);
                        });
                    }
                });

                // Handle removed nodes - clean up if they had filters
                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.cleanupRemovedElement(node);
                        // Clean up descendants too
                        node.querySelectorAll('*').forEach(el => {
                            this.cleanupRemovedElement(el);
                        });
                    }
                });
            } else if (mutation.type === 'attributes') {
                // Handle attribute changes (style, class) that might affect --fx-filter
                if (mutation.target.nodeType === Node.ELEMENT_NODE) {
                    elementsToCheck.add(mutation.target);
                }
            }
        });

        // Process all affected elements
        if (elementsToCheck.size > 0) {
            this.scanSpecificElements(Array.from(elementsToCheck));
        }
    }

    static cleanupRemovedElement(element) {
        const storedState = this.elements.get(element);
        if (storedState && storedState.hasContainer) {
            // Element was removed from DOM, clean up our tracking
            this.elements.delete(element);
            fxConsole.log('🧹 Cleaned up removed element from tracking');
        }
        
        // Remove from pending and stop observing
        this.pendingElements.delete(element);
        if (this.resizeObserver) {
            this.resizeObserver.unobserve(element);
        }
    }

    static scanElements() {
        // Scan all elements in the document (used for initial scan)
        const elements = document.querySelectorAll('*:not(.fx-container):not(svg)');
        this.scanSpecificElements(Array.from(elements));
    }

    static scanSpecificElements(elements) {
        // Scan only the provided elements for --fx-filter updates
        elements.forEach(element => {
            // Skip our generated containers and SVG elements
            if (element.classList.contains('fx-container') || element.tagName.toLowerCase() === 'svg') {
                return;
            }

            const fxFilter = this.getFxFilterValue(element);
            const storedState = this.elements.get(element);

            if (fxFilter) {
                // Check if element has zero dimensions using multiple methods
                const rect = element.getBoundingClientRect();
                const clientWidth = element.clientWidth || 0;
                const clientHeight = element.clientHeight || 0;
                const offsetWidth = element.offsetWidth || 0;
                const offsetHeight = element.offsetHeight || 0;
                
                // Element has zero dimensions if any of these are true
                const hasZeroDimensions = (
                    rect.width <= 0 || rect.height <= 0 ||
                    (clientWidth <= 0 && offsetWidth <= 0) ||
                    (clientHeight <= 0 && offsetHeight <= 0)
                );
                
                if (hasZeroDimensions) {
                    // Element has zero dimensions, add to pending and observe for resize
                    fxConsole.log('⏳ Element has zero dimensions, adding to pending list:', element, {
                        rect: { width: rect.width, height: rect.height },
                        client: { width: clientWidth, height: clientHeight },
                        offset: { width: offsetWidth, height: offsetHeight }
                    });
                    this.pendingElements.add(element);
                    
                    // Start observing this element for size changes
                    if (this.resizeObserver) {
                        this.resizeObserver.observe(element);
                    }
                    
                    // Skip processing for now
                    return;
                }
                
                // Remove from pending if it was there (element now has dimensions)
                if (this.pendingElements.has(element)) {
                    this.pendingElements.delete(element);
                    fxConsole.log('✅ Element now has dimensions, processing:', element);
                }

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
                    
                    // Start observing for size changes if supported
                    if (this.resizeObserver) {
                        this.resizeObserver.observe(element);
                    }
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
                    
                    // Stop observing this element
                    if (this.resizeObserver) {
                        this.resizeObserver.unobserve(element);
                    }
                }
                
                // Remove from pending if it was there
                this.pendingElements.delete(element);
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
            element.insertAdjacentHTML('beforeend', `
                <div class="fx-container" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; backdrop-filter: ${backdropFilter}; background: transparent; pointer-events: none; z-index: -1; overflow: hidden; border-radius: inherit;">
                    <svg style="position: absolute; width: 0; height: 0;">
                        ${svgContent}
                    </svg>
                </div>
            `);
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