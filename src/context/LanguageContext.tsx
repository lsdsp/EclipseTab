import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '../utils/storage';

export type Language = 'en' | 'zh';

interface Translations {
    settings: {
        position: string;
        center: string;
        bottom: string;
        iconSize: string;
        large: string;
        small: string;
        suggestions: string;
        suggestionsPrivacyHint: string;
        thirdPartyIconService: string;
        thirdPartyIconServiceHint: string;
        thirdPartyIconDomainsHint: string;
        openInNewTab: string;
        on: string;
        off: string;
        language: string;
        followSystem: string;
        lightTheme: string;
        darkTheme: string;
        defaultTheme: string;
        noTexture: string;
        confirmDelete: string;
    };
    search: {
        searchBy: string;
        searchBySuffix: string;
        searchButton: string;
        enableSuggestionsHint: string;
        enableSuggestionsAction: string;
        enablingSuggestionsAction: string;
        systemDefault: string;
        custom: string;
        customName: string;
        customUrl: string;
        addCustom: string;
        invalidUrl: string;
        deleteConfirm: string;
        noEngine: string;
    };
    contextMenu: {
        addSticker: string;
        addClockWidget: string;
        addPomodoroWidget: string;
        addTodoWidget: string;
        addCalendarWidget: string;
        widgetAutoGroupOn: string;
        widgetAutoGroupOff: string;
        groupSelection: string;
        ungroupSelection: string;
        lockSelection: string;
        unlockSelection: string;
        enableGridSnap: string;
        disableGridSnap: string;
        uploadImage: string;
        editMode: string;
        exitEditMode: string;
        settings: string;
        copyImage: string;
        exportImage: string;
        copyText: string;
        editSticker: string;
        exportAsImage: string;
        deleteSticker: string;
        edit: string;
        delete: string;
        restore: string;
    };
    modal: {
        edit: string;
        addNew: string;
        address: string;
        name: string;
        icon: string;
        getFromWebsite: string;
        useTextIcon: string;
        uploadNewIcon: string;
        cancel: string;
        save: string;
        add: string;
    };
    space: {
        title: string;
        addSpace: string;
        renameSpace: string;
        rename: string;
        deleteSpace: string;
        importSpace: string;
        exportSpace: string;
        exportAllSpaces: string;
        pinToTop: string;
        alreadyAtTop: string;
        deleteConfirm: string;
        importFailed: string;
        inputName: string;
        confirm: string;
        tooltip: string;
        switch: string;
        manage: string;
        deleteStickerConfirm: string;
        recycleBin: string;
        restoreHint: string;
        emptyRecycleBin: string;
        emptyRecycleBinHint: string;
        recycleBinLimitHint: string;
        rulesTitle: string;
        rulesNoItems: string;
        rulesAddTime: string;
        rulesAddDomain: string;
        rulesDomainPlaceholder: string;
        rulesEnableTabPermission: string;
        rulesPermissionEnabled: string;
        rulesCooldown: string;
        rulesQuietHours: string;
        rulesQuietStart: string;
        rulesQuietEnd: string;
        suggestionSwitchPrefix: string;
        suggestionReasonDomain: string;
        suggestionReasonTime: string;
        suggestionSwitchAction: string;
        suggestionDismissAction: string;
        suggestionRememberAction: string;
    };
    dock: {
        emptyHint: string;
    };
    textInput: {
        placeholder: string;
        s: string;
        m: string;
        l: string;
        cancel: string;
        confirm: string;
        fontLabel: string;
        fontHandwritten: string;
        fontNormal: string;
        fontCode: string;
        fontSizeIncrease: string;
        fontSizeDecrease: string;
    };
    widget: {
        clock: string;
        pomodoro: string;
        todo: string;
        focus: string;
        shortBreak: string;
        longBreak: string;
        focusMinutes: string;
        shortBreakMinutes: string;
        longBreakMinutes: string;
        longBreakEvery: string;
        start: string;
        pause: string;
        reset: string;
        skip: string;
        cycles: string;
        soundOn: string;
        soundOff: string;
        todoPlaceholder: string;
        todoAdd: string;
        todoEmpty: string;
        calendar: string;
        calendarEnable: string;
        calendarDisable: string;
        calendarUrlPlaceholder: string;
        calendarSave: string;
        calendarRefresh: string;
        calendarLastSync: string;
        calendarNoEvents: string;
        calendarPermissionHint: string;
        calendarLoadFailed: string;
        calendarImportFile: string;
        calendarImportSuccess: string;
    };
}

const translations: Record<Language, Translations> = {
    en: {
        settings: {
            position: 'Position',
            center: 'Center',
            bottom: 'Bottom',
            iconSize: 'Icon Size',
            large: 'Large',
            small: 'Small',
            suggestions: 'Suggestions',
            suggestionsPrivacyHint: 'Domains used after enabling: suggestqueries.google.com, www.google.com, suggestion.baidu.com',
            thirdPartyIconService: '3rd-party Icons',
            thirdPartyIconServiceHint: 'Enable external favicon services? This may send site domains to third-party providers.',
            thirdPartyIconDomainsHint: 'May contact icon providers: icons.duckduckgo.com, www.google.com (s2 favicon).',
            openInNewTab: 'New Tab',
            on: 'On',
            off: 'Off',
            language: 'Language',
            followSystem: 'Follow System',
            lightTheme: 'Light Theme',
            darkTheme: 'Dark Theme',
            defaultTheme: 'Default Theme',
            noTexture: 'No Texture',
            confirmDelete: 'Delete Confirmation',
        },
        search: {
            searchBy: 'Search by',
            searchBySuffix: '',
            searchButton: 'Search',
            enableSuggestionsHint: 'Enable search suggestions to see autocomplete.',
            enableSuggestionsAction: 'Enable',
            enablingSuggestionsAction: 'Enabling...',
            systemDefault: 'System Default',
            custom: 'Custom',
            customName: 'Display Name',
            customUrl: 'Search URL',
            addCustom: 'Add Custom Engine',
            invalidUrl: 'Please enter a valid URL.',
            deleteConfirm: 'Are you sure you want to delete "{name}"?',
            noEngine: 'No search engines. Add a custom one below.',
        },
        contextMenu: {
            addSticker: 'Add Sticker',
            addClockWidget: 'Add Clock Widget',
            addPomodoroWidget: 'Add Pomodoro Widget',
            addTodoWidget: 'Add Todo Widget',
            addCalendarWidget: 'Add Calendar Widget',
            widgetAutoGroupOn: 'Auto Group (On)',
            widgetAutoGroupOff: 'Auto Group (Off)',
            groupSelection: 'Group Selection',
            ungroupSelection: 'Ungroup Selection',
            lockSelection: 'Lock Selection',
            unlockSelection: 'Unlock Selection',
            enableGridSnap: 'Enable Grid Snap',
            disableGridSnap: 'Disable Grid Snap',
            uploadImage: 'Upload Image',
            editMode: 'Edit Mode',
            exitEditMode: 'Exit Edit Mode',
            settings: 'Settings',
            copyImage: 'Copy Image',
            exportImage: 'Export Image',
            copyText: 'Copy Text',
            editSticker: 'Edit Sticker',
            exportAsImage: 'Export as Image',
            deleteSticker: 'Delete Sticker',
            edit: 'Edit',
            delete: 'Delete',
            restore: 'Restore',
        },
        modal: {
            edit: 'Edit',
            addNew: 'Add new',
            address: 'Address',
            name: 'Name',
            icon: 'Icon',
            getFromWebsite: 'Get from website',
            useTextIcon: 'Use Text Icon',
            uploadNewIcon: 'Upload new icon',
            cancel: 'Cancel',
            save: 'Save',
            add: 'Add',
        },
        space: {
            title: 'Space',
            addSpace: 'Add space',
            renameSpace: 'Rename Space',
            rename: 'Rename',
            deleteSpace: 'Delete space',
            importSpace: 'Import Space',
            exportSpace: 'Export current space',
            exportAllSpaces: 'Export All Space',
            pinToTop: 'Pin to Top',
            alreadyAtTop: 'Already at the top',
            deleteConfirm: 'Are you sure you want to delete the space "{name}"?\nAll applications in this space will be deleted.',
            importFailed: 'Import failed: ',
            inputName: 'Input space name',
            confirm: 'Confirm',
            tooltip: 'Current space',
            switch: 'Left click: Switch space',
            manage: 'Right click: Manage space',
            deleteStickerConfirm: 'Are you sure you want to delete this sticker?',
            recycleBin: 'Recycle Bin',
            restoreHint: 'Swipe left to restore, swipe right to delete',
            emptyRecycleBin: 'No deleted items',
            emptyRecycleBinHint: 'Deleted stickers will appear here',
            recycleBinLimitHint: 'Recycle bin stores up to 50 stickers',
            rulesTitle: 'Space Rules',
            rulesNoItems: 'No rules yet',
            rulesAddTime: 'Add Workhour Rule',
            rulesAddDomain: 'Add Domain Rule',
            rulesDomainPlaceholder: 'example.com',
            rulesEnableTabPermission: 'Enable Domain Detect',
            rulesPermissionEnabled: 'Domain Detect Enabled',
            rulesCooldown: 'Suggestion Cooldown (min)',
            rulesQuietHours: 'Quiet Hours',
            rulesQuietStart: 'Start',
            rulesQuietEnd: 'End',
            suggestionSwitchPrefix: 'Suggested Space',
            suggestionReasonDomain: 'domain',
            suggestionReasonTime: 'time',
            suggestionSwitchAction: 'Switch',
            suggestionDismissAction: 'Dismiss',
            suggestionRememberAction: 'Remember',
        },
        dock: {
            emptyHint: 'Right-click or use top-right button to enter edit mode and add icons',
        },
        textInput: {
            placeholder: 'Enter text...',
            s: 'S',
            m: 'M',
            l: 'L',
            cancel: 'Cancel',
            confirm: 'Confirm',
            fontLabel: 'Font',
            fontHandwritten: 'Handwrite',
            fontNormal: 'Normal',
            fontCode: 'Code',
            fontSizeIncrease: 'Press + Increase, Shift for larger step',
            fontSizeDecrease: 'Press - Decrease, Shift for larger step',
        },
        widget: {
            clock: 'Clock',
            pomodoro: 'Pomodoro',
            todo: 'Todo',
            focus: 'Focus',
            shortBreak: 'Break',
            longBreak: 'Long Break',
            focusMinutes: 'Focus',
            shortBreakMinutes: 'Break',
            longBreakMinutes: 'Long',
            longBreakEvery: 'Every',
            start: 'Start',
            pause: 'Pause',
            reset: 'Reset',
            skip: 'Skip',
            cycles: 'Cycles',
            soundOn: 'Sound On',
            soundOff: 'Sound Off',
            todoPlaceholder: 'Add a task...',
            todoAdd: 'Add',
            todoEmpty: 'No tasks yet',
            calendar: 'Calendar',
            calendarEnable: 'Enable iCal',
            calendarDisable: 'Disable',
            calendarUrlPlaceholder: 'Paste iCal URL',
            calendarSave: 'Save',
            calendarRefresh: 'Refresh',
            calendarLastSync: 'Last sync',
            calendarNoEvents: 'No upcoming events',
            calendarPermissionHint: 'Only fetches this URL after you enable it.',
            calendarLoadFailed: 'Failed to load iCal',
            calendarImportFile: 'Import .ics',
            calendarImportSuccess: 'Imported from file',
        }
    },
    zh: {
        settings: {
            position: '布局位置',
            center: '居中',
            bottom: '底部',
            iconSize: '图标大小',
            large: '大',
            small: '小',
            suggestions: '搜索建议',
            suggestionsPrivacyHint: '启用后会访问：suggestqueries.google.com、www.google.com、suggestion.baidu.com',
            thirdPartyIconService: '第三方图标',
            thirdPartyIconServiceHint: '启用第三方图标服务后，网站域名可能会发送给第三方提供者。是否继续？',
            thirdPartyIconDomainsHint: '启用后可能访问图标服务：icons.duckduckgo.com、www.google.com（s2 favicon）。',
            openInNewTab: '新标签页',
            on: '开启',
            off: '关闭',
            language: '语言设置',
            followSystem: '跟随系统',
            lightTheme: '浅色模式',
            darkTheme: '深色模式',
            defaultTheme: '默认主题',
            noTexture: '无纹理',
            confirmDelete: '删除二次确认',
        },
        search: {
            searchBy: '使用',
            searchBySuffix: '',
            searchButton: '搜索',
            enableSuggestionsHint: '开启搜索建议后可显示自动补全',
            enableSuggestionsAction: '启用建议',
            enablingSuggestionsAction: '启用中...',
            systemDefault: '系统默认',
            custom: '自定义',
            customName: '显示名称',
            customUrl: '搜索 URL',
            addCustom: '添加自定义引擎',
            invalidUrl: '请输入有效的 URL',
            deleteConfirm: '确定要删除“{name}”吗？',
            noEngine: '暂无搜索引擎，请在下方添加自定义引擎',
        },
        contextMenu: {
            addSticker: '添加贴纸',
            addClockWidget: '添加时钟组件',
            addPomodoroWidget: '添加番茄钟组件',
            addTodoWidget: '添加待办组件',
            addCalendarWidget: '添加日历组件',
            widgetAutoGroupOn: '自动成组（开）',
            widgetAutoGroupOff: '自动成组（关）',
            groupSelection: '分组所选贴纸',
            ungroupSelection: '解组所选贴纸',
            lockSelection: '锁定所选贴纸',
            unlockSelection: '解锁所选贴纸',
            enableGridSnap: '启用网格吸附',
            disableGridSnap: '关闭网格吸附',
            uploadImage: '上传图片',
            editMode: '编辑模式',
            exitEditMode: '退出编辑',
            settings: '设置',
            copyImage: '复制图片',
            exportImage: '导出图片',
            copyText: '复制文本',
            editSticker: '编辑贴纸',
            exportAsImage: '导出为图片',
            deleteSticker: '删除贴纸',
            edit: '编辑',
            delete: '删除',
            restore: '还原',
        },
        modal: {
            edit: '编辑',
            addNew: '添加新项',
            address: '网址地址',
            name: '名称',
            icon: '图标',
            getFromWebsite: '获取网站图标',
            useTextIcon: '使用文字图标',
            uploadNewIcon: '上传新图标',
            cancel: '取消',
            save: '保存',
            add: '添加',
        },
        space: {
            title: '空间',
            addSpace: '添加空间',
            renameSpace: '重命名空间',
            rename: '重命名',
            deleteSpace: '删除空间',
            importSpace: '导入空间',
            exportSpace: '导出当前空间',
            exportAllSpaces: '导出所有空间',
            pinToTop: '置顶空间',
            alreadyAtTop: '已在顶部',
            deleteConfirm: '确定要删除空间 "{name}" 吗？\n该空间下的所有应用都将被删除。',
            importFailed: '导入失败：',
            inputName: '输入空间名称',
            confirm: '确认',
            tooltip: '当前空间',
            switch: '左键：切换空间',
            manage: '右键：管理空间',
            deleteStickerConfirm: '确定要删除这个贴纸吗？',
            recycleBin: '回收站',
            restoreHint: '左滑还原，右滑删除',
            emptyRecycleBin: '没有已删除的项目',
            emptyRecycleBinHint: '删除的贴纸将在这里显示',
            recycleBinLimitHint: '回收站最多存储50条贴纸',
            rulesTitle: '空间规则',
            rulesNoItems: '暂无规则',
            rulesAddTime: '添加工作时段规则',
            rulesAddDomain: '添加域名规则',
            rulesDomainPlaceholder: 'example.com',
            rulesEnableTabPermission: '启用域名检测',
            rulesPermissionEnabled: '域名检测已启用',
            rulesCooldown: '建议冷却（分钟）',
            rulesQuietHours: '静默时段',
            rulesQuietStart: '开始',
            rulesQuietEnd: '结束',
            suggestionSwitchPrefix: '建议切换空间',
            suggestionReasonDomain: '域名',
            suggestionReasonTime: '时间',
            suggestionSwitchAction: '切换',
            suggestionDismissAction: '忽略',
            suggestionRememberAction: '记住',
        },
        dock: {
            emptyHint: '右键或点击右上角进入编辑模式添加图标',
        },
        textInput: {
            placeholder: '输入文本...',
            s: '小',
            m: '中',
            l: '大',
            cancel: '取消',
            confirm: '确认',
            fontLabel: '字体',
            fontHandwritten: '手写',
            fontNormal: '普通',
            fontCode: '代码',
            fontSizeIncrease: '按 + 键增大字号，Shift 增大更多',
            fontSizeDecrease: '按 - 键减小字号，Shift 减小更多',
        },
        widget: {
            clock: '时钟',
            pomodoro: '番茄钟',
            todo: '待办',
            focus: '专注',
            shortBreak: '休息',
            longBreak: '长休息',
            focusMinutes: '专注',
            shortBreakMinutes: '短休',
            longBreakMinutes: '长休',
            longBreakEvery: '每隔',
            start: '开始',
            pause: '暂停',
            reset: '重置',
            skip: '跳过',
            cycles: '循环',
            soundOn: '提示音开',
            soundOff: '提示音关',
            todoPlaceholder: '添加待办事项...',
            todoAdd: '添加',
            todoEmpty: '暂无待办',
            calendar: '日历',
            calendarEnable: '启用 iCal',
            calendarDisable: '关闭',
            calendarUrlPlaceholder: '粘贴 iCal 地址',
            calendarSave: '保存',
            calendarRefresh: '刷新',
            calendarLastSync: '最近同步',
            calendarNoEvents: '暂无近期日程',
            calendarPermissionHint: '仅在你启用后访问该地址。',
            calendarLoadFailed: 'iCal 加载失败',
            calendarImportFile: '导入 .ics',
            calendarImportSuccess: '已从文件导入',
        }
    }
};

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>(() => {
        return storage.getLanguage();
    });

    useEffect(() => {
        storage.saveLanguage(language);
    }, [language]);

    const value = {
        language,
        setLanguage,
        t: translations[language]
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
