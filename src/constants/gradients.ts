export const GRADIENT_PRESETS = [
    {
        id: 'theme-default',
        name: '主题默认',
        gradient: '#F3F3F3', // Light theme default
        solid: '#F3F3F3',    // Will be overridden to #404040 for dark themes in component logic
    },
    {
        id: 'gradient-1',
        name: '梦幻紫粉',
        gradient: 'linear-gradient(to top, #a18cd1 0%, #fbc2eb 100%)',
        solid: '#a18cd1',
    },
    {
        id: 'gradient-2',
        name: '清新粉蓝',
        gradient: 'linear-gradient(to top, #fbc2eb 0%, #a6c1ee 100%)',
        solid: '#fbc2eb',
    },
    {
        id: 'gradient-3',
        name: '淡雅紫白',
        gradient: 'linear-gradient(to top, #cd9cf2 0%, #f6f3ff 100%)',
        solid: '#cd9cf2',
    },
    {
        id: 'gradient-4',
        name: '静谧蓝灰',
        gradient: 'linear-gradient(to top, #6a85b6 0%, #bac8e0 100%)',
        solid: '#6a85b6',
    },
    {
        id: 'gradient-5',
        name: '深邃蓝紫',
        gradient: 'linear-gradient(to top, #505285 0%, #585e92 12%, #65689f 25%, #7474b0 37%, #7e7ebb 50%, #8389c7 62%, #9795d4 75%, #a2a1dc 87%, #b5aee4 100%)',
        solid: '#505285',
    },
    {
        id: 'gradient-6',
        name: '柔和灰紫',
        gradient: 'linear-gradient(to top, #bdc2e8 0%, #bdc2e8 1%, #e6dee9 100%)',
        solid: '#bdc2e8',
    },
    {
        id: 'gradient-7',
        name: '暗夜微光',
        gradient: 'linear-gradient(to bottom, #323232 0%, #3F3F3F 40%, #1C1C1C 150%), linear-gradient(to top, rgba(255,255,255,0.40) 0%, rgba(0,0,0,0.25) 200%)',
        solid: '#323232',
        blendMode: 'multiply',
    },
] as const;

export type GradientPreset = typeof GRADIENT_PRESETS[number];
