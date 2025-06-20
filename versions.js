// FxFilter.js Versions Registry
// Generated automatically by release script
// Last updated: 2025-06-20T00:00:00.000Z

window.FxFilterVersions = {
    latest: "1.0.0",
    versions: [
        {
            "version": "1.0.0",
            "date": "2025-06-20",
            "tag": "v1.0.0",
            "url": "./v1.0.0/FxFilter.js"
        }
    ],
    
    // Get download URL for specific version
    getVersionUrl: function(version) {
        const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
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
