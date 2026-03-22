/**
 * Color Extractor — Pure client-side color extraction using K-Means clustering
 * No external dependencies.
 */

class ColorExtractor {
    /**
     * Extract dominant colors from an image element
     * @param {HTMLImageElement} img
     * @param {number} k - Number of colors to extract
     * @returns {Array<{hex: string, rgb: number[], percent: number}>}
     */
    static extract(img, k = 6) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Scale down for performance
        const maxDim = 200;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        const scale = Math.min(maxDim / w, maxDim / h, 1);
        w = Math.round(w * scale);
        h = Math.round(h * scale);

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const pixels = this._getPixels(imageData);

        if (pixels.length === 0) {
            return [{ hex: '#333333', rgb: [51, 51, 51], percent: 100 }];
        }

        const clusters = this._kMeans(pixels, k, 20);
        
        // Sort by cluster size (most dominant first)
        clusters.sort((a, b) => b.count - a.count);

        const total = clusters.reduce((s, c) => s + c.count, 0);

        return clusters.map(c => ({
            hex: this.rgbToHex(c.center),
            rgb: c.center.map(Math.round),
            percent: Math.round((c.count / total) * 100)
        }));
    }

    /**
     * Convert image data to pixel arrays, filtering out near-white, near-black, and transparent
     */
    static _getPixels(imageData) {
        const data = imageData.data;
        const pixels = [];
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            // Skip very transparent pixels
            if (a < 128) continue;

            // Skip near-white (all channels > 240)
            if (r > 240 && g > 240 && b > 240) continue;

            // Skip near-black (all channels < 15)
            if (r < 15 && g < 15 && b < 15) continue;

            pixels.push([r, g, b]);
        }

        // If too few pixels left, use all opaque pixels
        if (pixels.length < 10) {
            pixels.length = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] > 128) {
                    pixels.push([data[i], data[i + 1], data[i + 2]]);
                }
            }
        }

        return pixels;
    }

    /**
     * K-Means clustering
     */
    static _kMeans(pixels, k, maxIter) {
        // Initialize centers using k-means++
        const centers = this._kMeansPP(pixels, k);
        let assignments = new Array(pixels.length).fill(0);

        for (let iter = 0; iter < maxIter; iter++) {
            // Assign pixels to nearest center
            let changed = false;
            for (let i = 0; i < pixels.length; i++) {
                let minDist = Infinity;
                let minIdx = 0;
                for (let j = 0; j < centers.length; j++) {
                    const d = this._colorDist(pixels[i], centers[j]);
                    if (d < minDist) {
                        minDist = d;
                        minIdx = j;
                    }
                }
                if (assignments[i] !== minIdx) {
                    assignments[i] = minIdx;
                    changed = true;
                }
            }

            if (!changed) break;

            // Update centers
            const sums = centers.map(() => [0, 0, 0]);
            const counts = new Array(centers.length).fill(0);

            for (let i = 0; i < pixels.length; i++) {
                const a = assignments[i];
                sums[a][0] += pixels[i][0];
                sums[a][1] += pixels[i][1];
                sums[a][2] += pixels[i][2];
                counts[a]++;
            }

            for (let j = 0; j < centers.length; j++) {
                if (counts[j] > 0) {
                    centers[j] = [
                        sums[j][0] / counts[j],
                        sums[j][1] / counts[j],
                        sums[j][2] / counts[j]
                    ];
                }
            }
        }

        // Build result
        const clusterCounts = new Array(centers.length).fill(0);
        for (let i = 0; i < assignments.length; i++) {
            clusterCounts[assignments[i]]++;
        }

        return centers.map((center, i) => ({
            center: center.map(Math.round),
            count: clusterCounts[i]
        })).filter(c => c.count > 0);
    }

    /**
     * K-Means++ initialization
     */
    static _kMeansPP(pixels, k) {
        const centers = [];
        // First center: random pixel
        centers.push([...pixels[Math.floor(Math.random() * pixels.length)]]);

        for (let i = 1; i < k; i++) {
            const dists = pixels.map(p => {
                let min = Infinity;
                for (const c of centers) {
                    const d = this._colorDist(p, c);
                    if (d < min) min = d;
                }
                return min;
            });

            const totalDist = dists.reduce((a, b) => a + b, 0);
            if (totalDist === 0) break;

            let r = Math.random() * totalDist;
            for (let j = 0; j < pixels.length; j++) {
                r -= dists[j];
                if (r <= 0) {
                    centers.push([...pixels[j]]);
                    break;
                }
            }
        }

        return centers;
    }

    /**
     * Squared Euclidean distance in RGB space
     */
    static _colorDist(a, b) {
        const dr = a[0] - b[0];
        const dg = a[1] - b[1];
        const db = a[2] - b[2];
        return dr * dr + dg * dg + db * db;
    }

    /**
     * RGB array to HEX string
     */
    static rgbToHex(rgb) {
        return '#' + rgb.map(v => {
            const hex = Math.round(Math.max(0, Math.min(255, v))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    /**
     * HEX to RGB array
     */
    static hexToRgb(hex) {
        hex = hex.replace('#', '');
        return [
            parseInt(hex.substring(0, 2), 16),
            parseInt(hex.substring(2, 4), 16),
            parseInt(hex.substring(4, 6), 16)
        ];
    }

    /**
     * RGB to HSL
     */
    static rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return [h * 360, s * 100, l * 100];
    }

    /**
     * HSL to RGB
     */
    static hslToRgb(h, s, l) {
        h /= 360; s /= 100; l /= 100;
        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    /**
     * Generate shades of a color (from light to dark)
     * @param {string} hex
     * @param {number} count - number of shades
     * @returns {Array<{hex: string, label: string, lightness: number}>}
     */
    static generateShades(hex, count = 9) {
        const rgb = this.hexToRgb(hex);
        const [h, s, l] = this.rgbToHsl(...rgb);

        const shades = [];
        const labels = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];

        // Generate from lightest (95%) to darkest (10%)
        const steps = Math.min(count, labels.length);
        for (let i = 0; i < steps; i++) {
            const lightness = 95 - (i * (85 / (steps - 1)));
            // Keep saturation similar but reduce slightly for extreme lightness/darkness
            let saturation = s;
            if (lightness > 85) saturation = s * 0.6;
            else if (lightness > 70) saturation = s * 0.8;
            else if (lightness < 20) saturation = s * 0.85;

            const newRgb = this.hslToRgb(h, Math.min(saturation, 100), lightness);
            shades.push({
                hex: this.rgbToHex(newRgb),
                label: labels[i],
                lightness: Math.round(lightness)
            });
        }

        return shades;
    }

    /**
     * Generate neutral/support colors based on dominant colors
     * @param {Array} dominantColors
     * @returns {Array<{hex: string, label: string}>}
     */
    static generateNeutrals(dominantColors) {
        const neutrals = [];

        // Get average hue from dominant colors
        let avgH = 0;
        let count = 0;
        for (const c of dominantColors) {
            const [h, s] = this.rgbToHsl(...c.rgb);
            if (s > 5) { // Only consider chromatic colors
                avgH += h;
                count++;
            }
        }
        avgH = count > 0 ? avgH / count : 0;

        // Background shades (tinted with avg hue)
        const bgShades = [
            { l: 98, label: 'BG Claro', s: 3 },
            { l: 96, label: 'BG Secundário', s: 4 },
            { l: 93, label: 'BG Hover', s: 5 },
            { l: 12, label: 'BG Escuro', s: 10 },
            { l: 8, label: 'BG Profundo', s: 12 },
            { l: 4, label: 'BG Máximo', s: 8 },
        ];

        for (const bg of bgShades) {
            const rgb = this.hslToRgb(avgH, bg.s, bg.l);
            neutrals.push({ hex: this.rgbToHex(rgb), label: bg.label });
        }

        // Text colors
        const textShades = [
            { l: 95, label: 'Texto Principal', s: 2 },
            { l: 70, label: 'Texto Secundário', s: 4 },
            { l: 45, label: 'Texto Terciário', s: 6 },
            { l: 20, label: 'Texto Escuro', s: 3 },
        ];

        for (const t of textShades) {
            const rgb = this.hslToRgb(avgH, t.s, t.l);
            neutrals.push({ hex: this.rgbToHex(rgb), label: t.label });
        }

        // Border
        const borderRgb = this.hslToRgb(avgH, 6, 80);
        neutrals.push({ hex: this.rgbToHex(borderRgb), label: 'Borda' });

        return neutrals;
    }

    /**
     * Remove duplicate / very similar colors
     */
    static deduplicateColors(colors, threshold = 30) {
        const unique = [];
        for (const color of colors) {
            const isDuplicate = unique.some(u => {
                return this._colorDist(u.rgb, color.rgb) < threshold * threshold;
            });
            if (!isDuplicate) {
                unique.push(color);
            }
        }
        return unique;
    }

    /**
     * Get a contrasting text color (black or white) for a given background
     */
    static getContrastColor(hex) {
        const rgb = this.hexToRgb(hex);
        // Relative luminance
        const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
        return luminance > 0.5 ? '#1a1a1a' : '#ffffff';
    }
}

// Export for use
window.ColorExtractor = ColorExtractor;
