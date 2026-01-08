import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import enCommon from '@/locales/en/common.json';
import enAuth from '@/locales/en/auth.json';
import enStream from '@/locales/en/stream.json';
import enPayments from '@/locales/en/payments.json';
import enErrors from '@/locales/en/errors.json';
import enSocial from '@/locales/en/social.json';

import esCommon from '@/locales/es/common.json';
import esAuth from '@/locales/es/auth.json';
import esStream from '@/locales/es/stream.json';
import esPayments from '@/locales/es/payments.json';
import esErrors from '@/locales/es/errors.json';
import esSocial from '@/locales/es/social.json';

import frCommon from '@/locales/fr/common.json';
import frAuth from '@/locales/fr/auth.json';
import frStream from '@/locales/fr/stream.json';
import frPayments from '@/locales/fr/payments.json';
import frErrors from '@/locales/fr/errors.json';
import frSocial from '@/locales/fr/social.json';

import zhCommon from '@/locales/zh/common.json';
import zhAuth from '@/locales/zh/auth.json';
import zhStream from '@/locales/zh/stream.json';
import zhPayments from '@/locales/zh/payments.json';
import zhErrors from '@/locales/zh/errors.json';
import zhSocial from '@/locales/zh/social.json';

export const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    stream: enStream,
    payments: enPayments,
    errors: enErrors,
    social: enSocial,
  },
  es: {
    common: esCommon,
    auth: esAuth,
    stream: esStream,
    payments: esPayments,
    errors: esErrors,
    social: esSocial,
  },
  fr: {
    common: frCommon,
    auth: frAuth,
    stream: frStream,
    payments: frPayments,
    errors: frErrors,
    social: frSocial,
  },
  zh: {
    common: zhCommon,
    auth: zhAuth,
    stream: zhStream,
    payments: zhPayments,
    errors: zhErrors,
    social: zhSocial,
  },
} as const;

export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'stream', 'payments', 'errors', 'social'],

    interpolation: {
      escapeValue: false, // React already escapes by default
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;
