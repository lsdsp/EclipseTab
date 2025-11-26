export const GRADIENT_PRESETS = [
    {
        id: 'theme-default',
        name: '主题默认',
        gradient: '#F3F3F3', // Light theme default
        solid: '#F3F3F3',    // Will be overridden to #404040 for dark themes in component logic
    },
    {
        id: 'default',
        name: '默认蓝色',
        gradient: 'linear-gradient(180deg, #00020E 0%, #071633 25%, #3966AD 65%, #8BA9D4 100%)',
        solid: '#3966AD',
    },
    {
        id: 'sunset',
        name: '日落橙',
        gradient: 'linear-gradient(180deg, #1a0505 0%, #4a1a0a 25%, #d4682c 65%, #f4a460 100%)',
        solid: '#d4682c',
    },
    {
        id: 'forest',
        name: '森林绿',
        gradient: 'linear-gradient(180deg, #0a1a0a 0%, #1a3a1a 25%, #2d6e4a 65%, #5a9e7a 100%)',
        solid: '#2d6e4a',
    },
    {
        id: 'purple',
        name: '紫罗兰',
        gradient: 'linear-gradient(180deg, #1a0a1a 0%, #3a1a3a 25%, #6a4a8a 65%, #9a7aba 100%)',
        solid: '#6a4a8a',
    },
    {
        id: 'ocean',
        name: '海洋蓝',
        gradient: 'linear-gradient(180deg, #0a0a1a 0%, #1a2a4a 25%, #2a5a8a 65%, #5a8aba 100%)',
        solid: '#2a5a8a',
    },
    {
        id: 'rose',
        name: '玫瑰粉',
        gradient: 'linear-gradient(180deg, #1a0510 0%, #3a1a2a 25%, #8a4a6a 65%, #ba7a9a 100%)',
        solid: '#8a4a6a',
    },
    {
        id: 'midnight',
        name: '午夜黑',
        gradient: 'linear-gradient(180deg, #000000 0%, #1a1a1a 50%, #333333 100%)',
        solid: '#1a1a1a',
    },
    {
        id: 'dawn',
        name: '晨曦金',
        gradient: 'linear-gradient(180deg, #332200 0%, #664400 50%, #996600 100%)',
        solid: '#996600',
    },
    {
        id: 'mint',
        name: '薄荷绿',
        gradient: 'linear-gradient(180deg, #0a1a1a 0%, #1a3a2a 25%, #2a6a4a 65%, #5a9a7a 100%)',
        solid: '#2a6a4a',
    },
] as const;

export type GradientPreset = typeof GRADIENT_PRESETS[number];
