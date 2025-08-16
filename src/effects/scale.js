/**
 * scale effect
 * 
 * Combinations:
 * - (scale, edgeMode)
 * - (scaleX, scaleY)
 * - (scaleX, scaleY, edgeMode)
 */
export default {
    name: 'scale',
    callback: (element, ...arguments_) => {
        let scaleX = 1, scaleY = 1, edgeMode;
        if (arguments_.length === 2) {
            if (!isNaN(Number(arguments_[1]))) {
                // (scale, edgeMode)
                scaleX = Number(arguments_[0]);
                scaleY = scaleX;
                edgeMode = arguments_[1];
            } else {
                // (scaleX, scaleY)
                scaleX = Number(arguments_[0]);
                scaleY = Number(arguments_[1]);
            }
        } else if (arguments_.length === 3) {
            // (scaleX, scaleY, edgeMode)
            scaleX = Number(arguments_[0]);
            scaleY = Number(arguments_[1]);
            edgeMode = arguments_[2];
        } else if (arguments_.length === 1) {
            scaleX = scaleY = Number(arguments_[0]);
        }
        if (
            isNaN(scaleX) || isNaN(scaleY) ||
            !isFinite(scaleX) || !isFinite(scaleY) ||
            scaleX === 0 || scaleY === 0
        ) {
            return '';
        }
        edgeMode = ["duplicate", "wrap", "none"].includes(edgeMode) ? edgeMode : "none";
        const c_scaleX = 1 / scaleX;
        const c_scaleY = 1 / scaleY;
        if (c_scaleX == 0 || c_scaleY == 0 || (c_scaleX == 1 && c_scaleY == 1)) return '';
        return `
        <feImage result="gradient" xlink:href="data:image/svg+xml;utf8,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
            <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="rgba(0,0,0,.5)"/>
                <stop offset="100%" stop-color="rgba(255,255,255,.5)"/>
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#g)"/>
            </svg>`
        )}" />
        <feImage result="gradient2" xlink:href="data:image/svg+xml;utf8,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
            <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgba(0,0,0,.5)"/>
                <stop offset="100%" stop-color="rgba(255,255,255,.5)"/>
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#g)"/>
            </svg>`
        )}" />
        <feDisplacementMap in2="gradient2" in="SourceGraphic" scale="${element.offsetHeight * (c_scaleY - 1)}" xChannelSelector="A" yChannelSelector="R" result="disp1" x="0" y="0" width="100%" height="100%"/>
                <feDisplacementMap in2="gradient" in="disp1" scale="${element.offsetWidth * (c_scaleX - 1)}" xChannelSelector="R" yChannelSelector="A" result="disp1" x="0" y="0" width="100%" height="100%"/>

        `;
    },
    updatesOn: ['width', 'height']
}