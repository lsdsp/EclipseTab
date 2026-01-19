import { Sticker } from '../types';

/**
 * Downloads a Blob as a file with the given filename.
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Copies a Blob to the clipboard as a PNG image.
 */
export async function copyBlobToClipboard(blob: Blob): Promise<void> {
    try {
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);
    } catch (error) {
        console.error('Failed to copy blob to clipboard:', error);
        throw error;
    }
}

/**
 * Converts an HTMLImageElement to a Blob (PNG).
 * @param img The loaded image element.
 */
export function imageToBlob(img: HTMLImageElement): Promise<Blob | null> {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png');
        } else {
            resolve(null);
        }
    });
}

/**
 * Generates a PNG Blob for a Text Sticker.
 * Handles styling, padding, and text drawing.
 */
export function createTextStickerImage(sticker: Sticker): Promise<Blob | null> {
    return new Promise((resolve) => {
        if (sticker.type !== 'text') {
            resolve(null);
            return;
        }

        // Get stroke color from CSS variable
        const strokeColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--color-sticker-stroke').trim() || 'white';

        const MIN_HEIGHT = 600;
        const BASE_FONT_SIZE = 48;
        // const PADDING_RATIO = 0.5; // Removed: unused
        const STROKE_RATIO = 0.25;

        // Create temp canvas for measurement
        const measureCanvas = document.createElement('canvas');
        const measureCtx = measureCanvas.getContext('2d');
        if (!measureCtx) {
            resolve(null);
            return;
        }

        // Match CSS styles: font-weight 900, line-height 0.9, Bricolage Grotesque
        measureCtx.font = `900 ${BASE_FONT_SIZE}px "Bricolage Grotesque", sans-serif`;

        // Measure text content
        const lines = sticker.content.split('\n');
        const lineHeight = BASE_FONT_SIZE * 0.9;

        // Find max line width
        let maxWidth = 0;
        for (const line of lines) {
            const metrics = measureCtx.measureText(line);
            maxWidth = Math.max(maxWidth, metrics.width);
        }

        // Calculate content dimensions with extra buffer for stroke
        // CSS Padding: 12px vertical, 16px horizontal
        // Stroke: 12px (6px outside)
        const strokeWidth = BASE_FONT_SIZE * STROKE_RATIO;
        const strokeBuffer = strokeWidth / 2;

        const paddingX = 16 + strokeBuffer;
        const paddingY = 12 + strokeBuffer;

        const contentWidth = maxWidth;
        const contentHeight = lineHeight * lines.length;

        // Add extra vertical buffer for ascenders/descenders slightly clipping with tight line-height
        const verticalBuffer = BASE_FONT_SIZE * 0.2;

        const baseWidth = contentWidth + paddingX * 2;
        const baseHeight = contentHeight + paddingY * 2 + verticalBuffer;

        // Scale to ensure min height while preserving aspect ratio
        const scale = baseHeight < MIN_HEIGHT ? MIN_HEIGHT / baseHeight : 1;
        const canvasWidth = Math.ceil(baseWidth * scale);
        const canvasHeight = Math.ceil(baseHeight * scale);
        const fontSize = Math.round(BASE_FONT_SIZE * scale);

        const finalPaddingX = Math.round(paddingX * scale);
        // const finalPaddingY = Math.round(paddingY * scale); // Unused variable

        const finalStrokeWidth = Math.round(strokeWidth * scale);
        const finalLineHeight = fontSize * 0.9;

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            // Set text style
            ctx.font = `900 ${fontSize}px "Bricolage Grotesque", sans-serif`;
            ctx.textBaseline = 'middle';

            // Calculate text position based on alignment
            let textX: number;
            if (sticker.style?.textAlign === 'center') {
                ctx.textAlign = 'center';
                textX = canvasWidth / 2;
            } else if (sticker.style?.textAlign === 'right') {
                ctx.textAlign = 'right';
                textX = canvasWidth - finalPaddingX;
            } else {
                ctx.textAlign = 'left';
                textX = finalPaddingX;
            }

            // Draw stroke using --color-sticker-stroke
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = finalStrokeWidth;
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;

            // Calculate vertical center
            const totalTextHeight = finalLineHeight * lines.length;
            // Center in canvas
            let y = (canvasHeight - totalTextHeight) / 2 + finalLineHeight / 2;

            for (const line of lines) {
                ctx.strokeText(line, textX, y);
                y += finalLineHeight;
            }

            // Draw fill color
            ctx.fillStyle = sticker.style?.color || '#1C1C1E';
            y = (canvasHeight - totalTextHeight) / 2 + finalLineHeight / 2;
            for (const line of lines) {
                ctx.fillText(line, textX, y);
                y += finalLineHeight;
            }

            // Convert to Blob
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png');
        } else {
            resolve(null);
        }
    });
}

/**
 * Generates a PNG Blob for an Image Sticker with rounded corners, stroke, and shadow.
 */
export function createImageStickerImage(sticker: Sticker): Promise<Blob | null> {
    return new Promise((resolve) => {
        if (sticker.type !== 'image') {
            resolve(null);
            return;
        }

        const img = new Image();
        img.onload = () => {
            // Get stroke color from CSS variable
            const strokeColor = getComputedStyle(document.documentElement)
                .getPropertyValue('--color-sticker-stroke').trim() || 'white';

            const BORDER_RADIUS = 16;
            const STROKE_WIDTH = 6;
            const SHADOW_BLUR = 12;
            const SHADOW_OFFSET = 6;
            const PADDING = STROKE_WIDTH + SHADOW_BLUR;

            // Canvas size includes image + padding for stroke and shadow
            const canvasWidth = img.width + PADDING * 2;
            const canvasHeight = img.height + PADDING * 2 + SHADOW_OFFSET;

            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');

            if (ctx) {
                const imgX = PADDING;
                const imgY = PADDING;

                // Create rounded rectangle path
                const createRoundedPath = (x: number, y: number, w: number, h: number, r: number) => {
                    ctx.beginPath();
                    ctx.moveTo(x + r, y);
                    ctx.lineTo(x + w - r, y);
                    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
                    ctx.lineTo(x + w, y + h - r);
                    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                    ctx.lineTo(x + r, y + h);
                    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
                    ctx.lineTo(x, y + r);
                    ctx.quadraticCurveTo(x, y, x + r, y);
                    ctx.closePath();
                };

                // Draw drop shadow
                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
                ctx.shadowBlur = SHADOW_BLUR;
                ctx.shadowOffsetY = SHADOW_OFFSET;
                createRoundedPath(imgX, imgY, img.width, img.height, BORDER_RADIUS);
                ctx.fillStyle = 'white';
                ctx.fill();
                ctx.restore();

                // Draw stroke/outline using --color-sticker-stroke
                createRoundedPath(imgX, imgY, img.width, img.height, BORDER_RADIUS);
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = STROKE_WIDTH * 2; // Double because half is clipped
                ctx.stroke();

                // Clip to rounded rectangle and draw image
                ctx.save();
                createRoundedPath(imgX, imgY, img.width, img.height, BORDER_RADIUS);
                ctx.clip();
                ctx.drawImage(img, imgX, imgY);
                ctx.restore();

                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/png');
            } else {
                resolve(null);
            }
        };
        img.onerror = () => {
            console.error('Failed to load image for sticker export');
            resolve(null);
        };
        img.src = sticker.content;
    });
}
