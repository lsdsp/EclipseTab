import React, { useEffect, useState } from 'react';
import { useThemeData } from '../../context/ThemeContext';
import styles from './Background.module.css';

// Helper function to extract URL from background value
// Only returns URL if the background is purely a wallpaper image
// Returns null if background contains texture overlays or other complex values
const extractUrl = (bgValue: string): string | null => {
    // If the background contains a comma, it has multiple layers (e.g., texture + color)
    // In this case, we should render as a div with background style, not as an img
    if (bgValue.includes(',')) {
        return null;
    }
    // Only match if the entire value is a single url()
    const match = bgValue.match(/^url\(['\"]?([^'\"]+)['\"]?\)$/);
    return match ? match[1] : null;
};

// Helper function to compute background properties based on background value
// Returns the appropriate size, position, and repeat values
const getBackgroundProps = (bgValue: string) => {
    // Check if background has multiple layers (contains comma)
    const hasMultipleLayers = bgValue.includes(',');
    if (hasMultipleLayers) {
        // Multi-layer background (texture + color): both layers use cover
        return {
            backgroundSize: 'cover, cover',
            backgroundPosition: 'center, center',
            backgroundRepeat: 'no-repeat, no-repeat',
        };
    }
    // Single layer background
    return {
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
    };
};

interface LayerState {
    bg: string;
    blendMode: string;
    bgProps: ReturnType<typeof getBackgroundProps>;
}

export const Background: React.FC = () => {
    const { backgroundValue, backgroundBlendMode } = useThemeData();

    // Store complete layer state including background properties
    const [layer1, setLayer1] = useState<LayerState>({
        bg: backgroundValue,
        blendMode: backgroundBlendMode,
        bgProps: getBackgroundProps(backgroundValue),
    });
    const [layer2, setLayer2] = useState<LayerState>({
        bg: '',
        blendMode: backgroundBlendMode,
        bgProps: getBackgroundProps(''),
    });
    const [activeLayer, setActiveLayer] = useState<1 | 2>(1);

    useEffect(() => {
        if (activeLayer === 1) {
            if (layer1.bg !== backgroundValue) {
                setLayer2({
                    bg: backgroundValue,
                    blendMode: backgroundBlendMode,
                    bgProps: getBackgroundProps(backgroundValue),
                });
                setActiveLayer(2);
            }
        } else {
            if (layer2.bg !== backgroundValue) {
                setLayer1({
                    bg: backgroundValue,
                    blendMode: backgroundBlendMode,
                    bgProps: getBackgroundProps(backgroundValue),
                });
                setActiveLayer(1);
            }
        }
    }, [backgroundValue, backgroundBlendMode, activeLayer, layer1.bg, layer2.bg]);

    // Extract URLs if backgrounds are wallpapers
    const url1 = extractUrl(layer1.bg);
    const url2 = extractUrl(layer2.bg);

    return (
        <div className={styles.container}>
            {/* Layer 1 */}
            {url1 ? (
                <img
                    src={url1}
                    alt=""
                    className={styles.layer}
                    style={{
                        mixBlendMode: layer1.blendMode as any,
                        opacity: activeLayer === 1 ? 1 : 0,
                        zIndex: activeLayer === 1 ? 2 : 1,
                    }}
                />
            ) : (
                <div
                    className={styles.layer}
                    style={{
                        background: layer1.bg,
                        backgroundBlendMode: layer1.blendMode,
                        backgroundSize: layer1.bgProps.backgroundSize,
                        backgroundPosition: layer1.bgProps.backgroundPosition,
                        backgroundRepeat: layer1.bgProps.backgroundRepeat as any,
                        opacity: activeLayer === 1 ? 1 : 0,
                        zIndex: activeLayer === 1 ? 2 : 1,
                    }}
                />
            )}

            {/* Layer 2 */}
            {url2 ? (
                <img
                    src={url2}
                    alt=""
                    className={styles.layer}
                    style={{
                        mixBlendMode: layer2.blendMode as any,
                        opacity: activeLayer === 2 ? 1 : 0,
                        zIndex: activeLayer === 2 ? 2 : 1,
                    }}
                />
            ) : (
                <div
                    className={styles.layer}
                    style={{
                        background: layer2.bg,
                        backgroundBlendMode: layer2.blendMode,
                        backgroundSize: layer2.bgProps.backgroundSize,
                        backgroundPosition: layer2.bgProps.backgroundPosition,
                        backgroundRepeat: layer2.bgProps.backgroundRepeat as any,
                        opacity: activeLayer === 2 ? 1 : 0,
                        zIndex: activeLayer === 2 ? 2 : 1,
                    }}
                />
            )}
        </div>
    );
};
