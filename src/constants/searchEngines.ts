import { SearchEngine } from '../types';

export const GOOGLE_ENGINE: SearchEngine = {
  id: 'google',
  name: 'Google',
  url: 'https://www.google.com/search?q=',
};

export const SEARCH_ENGINES: SearchEngine[] = [
  GOOGLE_ENGINE,
  {
    id: 'bing',
    name: 'Bing',
    url: 'https://www.bing.com/search?q=',
  },
  {
    id: 'baidu',
    name: 'Baidu',
    url: 'https://www.baidu.com/s?wd=',
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    url: 'https://duckduckgo.com/?q=',
  },
];

// 默认回退使用 Google 搜索引擎
export const DEFAULT_SEARCH_ENGINE: SearchEngine = GOOGLE_ENGINE;

