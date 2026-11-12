import type englishMessages from '@/public/_locales/en/messages.json';

export type MessageKey = keyof typeof englishMessages;

export function t(key: MessageKey, substitutions?: string | string[]): string {
  return chrome.i18n.getMessage(key, substitutions);
}

export function translatePage(): void {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n as MessageKey);
  }
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-title]')) {
    element.title = t(element.dataset.i18nTitle as MessageKey);
  }
}
