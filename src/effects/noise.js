export default {
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
}