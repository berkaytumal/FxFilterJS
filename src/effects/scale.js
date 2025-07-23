export default {
    name: 'scale',
    callback: (element, scale = 1, centerX = '50%', centerY = '50%') => {
        const width = Math.round(element.offsetWidth);
        const height = Math.round(element.offsetHeight);
        scale = 1 / scale

        // Helper function to create displacement map with given refraction
        function createDisplacementMap() {
            const imageData = new ImageData(maxDimension, maxDimension);
            const data = imageData.data;
            const centerX = maxDimension / 2;
            const centerY = maxDimension / 2;
            const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

            for (let y = 0; y < maxDimension; y++) {
                for (let x = 0; x < maxDimension; x++) {
                    const dx = (centerX - x) / maxDist; // normalized direction to center
                    const dy = (centerY - y) / maxDist;
                    const pixelIndex = (y * maxDimension + x) * 4;
                    data[pixelIndex] = Math.round(127 + 127 * dx); // R channel (X)
                    data[pixelIndex + 1] = 127;                        // G channel (unused)
                    data[pixelIndex + 2] = Math.round(127 + 127 * dy); // B channel (Y)
                    data[pixelIndex + 3] = 255;                        // A channel
                }
            }
            return imageData;
        }

        // Helper function to create canvas with displacement map and apply blur/mask
        function createCanvasFromImageData(imageData) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // Center the displacement map on the canvas
            const offsetX = (maxDimension - width) / 2;
            const offsetY = (maxDimension - height) / 2;
            ctx.putImageData(imageData, -Math.round(offsetX), -Math.round(offsetY));

            const dataURL = canvas.toDataURL();
            canvas.remove();
            return dataURL;
        }

        const maxDimension = Math.ceil(Math.max(width, height));

        const imageData = createDisplacementMap();
        const dataURL = createCanvasFromImageData(imageData);

        // Calculate diagonal size
        const diagonal = Math.sqrt(width * width + height * height);
        const displacementScale = (1 - scale) * (diagonal / 2);

        return `
            <feImage result="FEIMG" href="${dataURL}" color-interpolation-filters="sRGB"/>
            <feDisplacementMap in="SourceGraphic" in2="FEIMG" scale="${displacementScale}" yChannelSelector="B" xChannelSelector="R" color-interpolation-filters="sRGB"/>
            `;

    },
    updatesOn: ['width', 'height']
}