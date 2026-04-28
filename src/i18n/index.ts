import { createI18n } from 'vue-i18n';
import en from './locales/en';
import zhTW from './locales/zh-TW';

const savedLocale = typeof window !== 'undefined' ? localStorage.getItem('trip_collab_locale') : null;
const defaultLocale = savedLocale || (navigator.language.startsWith('zh') ? 'zh-TW' : 'en');

const i18n = createI18n({
  legacy: false, // use Composition API
  globalInjection: true,
  locale: defaultLocale,
  fallbackLocale: 'en',
  messages: {
    en,
    'zh-TW': zhTW,
  },
});

export default i18n;
