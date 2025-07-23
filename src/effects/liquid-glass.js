export default {
    name: "liquid-glass",
    callback: (element, refraction = 1, offset = 10, chromatic = 0) => {
        const width = Math.round(element.offsetWidth);
        const height = Math.round(element.offsetHeight);
        const refractionValue = parseFloat(refraction) / 2 || 0;
        const offsetValue = (parseFloat(offset) || 0) / 2;
        const chromaticValue = parseFloat(chromatic) || 0;
        const borderRadiusStr = window.getComputedStyle(element).borderRadius || '0';
        let borderRadius = 0;

        if (borderRadiusStr.includes('%')) {
            // Handle percentage border radius
            const percentage = parseFloat(borderRadiusStr);
            const elementSize = Math.min(element.offsetWidth, element.offsetHeight);
            borderRadius = (percentage / 100) * elementSize;
        } else {
            // Handle pixel values
            borderRadius = parseFloat(borderRadiusStr);
        }

        // Helper function to create displacement map with given refraction
        function createDisplacementMap(refractionMod) {
            const adjustedRefraction = refractionValue + refractionMod;
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
            const topOffset = Math.floor(maxDimension / 2);
            for (let y = 0; y < topOffset; y++) {
                for (let x = 0; x < maxDimension; x++) {
                    const gradientSegment = (topOffset - y) / topOffset; // bottom to top
                    const pixelIndex = (y * maxDimension + x) * 4;
                    const vyValue = 1 * adjustedRefraction;
                    data[pixelIndex + 2] = Math.max(0, Math.min(255, Math.round(127 + 127 * vyValue * Math.pow(gradientSegment, 1))));
                }
            }

            // Apply bottom edge displacement
            for (let y = maxDimension - topOffset; y < maxDimension; y++) {
                for (let x = 0; x < maxDimension; x++) {
                    const gradientSegment = (y - (maxDimension - topOffset)) / topOffset; // top to bottom
                    const pixelIndex = (y * maxDimension + x) * 4;
                    const vyValue = -1 * adjustedRefraction;
                    data[pixelIndex + 2] = Math.max(0, Math.min(255, Math.round(127 + 127 * vyValue * Math.pow(gradientSegment, 1))));
                }
            }

            // Apply left edge displacement
            const leftOffset = Math.floor(maxDimension / 2);
            for (let y = 0; y < maxDimension; y++) {
                for (let x = 0; x < leftOffset; x++) {
                    const gradientSegment = (leftOffset - x) / leftOffset; // right to left
                    const pixelIndex = (y * maxDimension + x) * 4;
                    const vxValue = 1 * adjustedRefraction;
                    data[pixelIndex] = Math.max(0, Math.min(255, Math.round(127 + 127 * vxValue * Math.pow(gradientSegment, 1))));
                }
            }

            // Apply right edge displacement
            for (let y = 0; y < maxDimension; y++) {
                for (let x = maxDimension - leftOffset; x < maxDimension; x++) {
                    const gradientSegment = (x - (maxDimension - leftOffset)) / leftOffset; // left to right
                    const pixelIndex = (y * maxDimension + x) * 4;
                    const vxValue = -1 * adjustedRefraction;
                    data[pixelIndex] = Math.max(0, Math.min(255, Math.round(127 + 127 * vxValue * Math.pow(gradientSegment, 1))));
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
            return dataURL;
        }

        const maxDimension = Math.ceil(Math.max(width, height));

        // If no chromatic aberration, use simple single displacement
        if (chromaticValue === 0) {
            const imageData = createDisplacementMap(0);
            const dataURL = createCanvasFromImageData(imageData);

            return `
                <feImage result="FEIMG" href="${dataURL}" color-interpolation-filters="sRGB"/>
                <feDisplacementMap in="SourceGraphic" in2="FEIMG" scale="127" yChannelSelector="B" xChannelSelector="R" color-interpolation-filters="sRGB"/>
            `;
        } else {
            // Create three displacement maps with different refraction values
            const chromaticOffset = chromaticValue * 0.25; // Scale the chromatic offset

            const redImageData = createDisplacementMap(chromaticOffset);  // R: +0.25 * chromatic
            const greenImageData = createDisplacementMap(0);             // G: normal refraction
            const blueImageData = createDisplacementMap(-chromaticOffset); // B: -0.25 * chromatic

            const redDataURL = createCanvasFromImageData(redImageData);
            const greenDataURL = createCanvasFromImageData(greenImageData);
            const blueDataURL = createCanvasFromImageData(blueImageData);

            return `
                <!-- Red channel displacement -->
                <feImage result="redImg" href="${redDataURL}" color-interpolation-filters="sRGB"/>
                <feDisplacementMap in="SourceGraphic" in2="redImg" scale="127" yChannelSelector="B" xChannelSelector="R" color-interpolation-filters="sRGB" result="redDisplaced"/>
                <feComponentTransfer in="redDisplaced" result="redChannel">
                    <feFuncR type="identity"/>
                    <feFuncG type="discrete" tableValues="0"/>
                    <feFuncB type="discrete" tableValues="0"/>
                    <feFuncA type="identity"/>
                </feComponentTransfer>

                <!-- Green channel displacement -->
                <feImage result="greenImg" href="${greenDataURL}" color-interpolation-filters="sRGB"/>
                <feDisplacementMap in="SourceGraphic" in2="greenImg" scale="127" yChannelSelector="B" xChannelSelector="R" color-interpolation-filters="sRGB" result="greenDisplaced"/>
                <feComponentTransfer in="greenDisplaced" result="greenChannel">
                    <feFuncR type="discrete" tableValues="0"/>
                    <feFuncG type="identity"/>
                    <feFuncB type="discrete" tableValues="0"/>
                    <feFuncA type="identity"/>
                </feComponentTransfer>

                <!-- Blue channel displacement -->
                <feImage result="blueImg" href="${blueDataURL}" color-interpolation-filters="sRGB"/>
                <feDisplacementMap in="SourceGraphic" in2="blueImg" scale="127" yChannelSelector="B" xChannelSelector="R" color-interpolation-filters="sRGB" result="blueDisplaced"/>
                <feComponentTransfer in="blueDisplaced" result="blueChannel">
                    <feFuncR type="discrete" tableValues="0"/>
                    <feFuncG type="discrete" tableValues="0"/>
                    <feFuncB type="identity"/>
                    <feFuncA type="identity"/>
                </feComponentTransfer>

                <!-- Combine all channels -->
                <feComposite in="redChannel" in2="greenChannel" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="redGreen"/>
                <feComposite in="redGreen" in2="blueChannel" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="final"/>
            `;
        }
    },
    updatesOn: ['border-radius', 'width', 'height']
}