import { describe, it, expect } from 'vitest';
import guidePage from '../../entrypoints/guide/index.html?raw';
import popupPage from '../../entrypoints/popup/index.html?raw';
import setupPage from '../../entrypoints/setup/index.html?raw';
import english from '../../public/_locales/en/messages.json';
import portuguese from '../../public/_locales/pt_BR/messages.json';

type Message = { message: string; placeholders?: Record<string, { content: string }> };
type Catalog = Record<string, Message>;

const catalogs: Record<string, Catalog> = { en: english, pt_BR: portuguese };

function placeholderNames(message: Message): string[] {
  return Object.keys(message.placeholders ?? {}).sort();
}

function referencedPlaceholders(message: Message): string[] {
  return [...message.message.matchAll(/\$([A-Za-z0-9_]+)\$/g)]
    .map((match) => (match[1] ?? '').toLowerCase())
    .sort();
}

describe('locale catalogs', () => {
  const englishKeys = Object.keys(english).sort();

  it('have the same keys in every language', () => {
    for (const catalog of Object.values(catalogs)) {
      expect(Object.keys(catalog).sort()).toEqual(englishKeys);
    }
  });

  it('have no empty messages', () => {
    for (const catalog of Object.values(catalogs)) {
      for (const message of Object.values(catalog)) {
        expect(message.message.trim()).not.toBe('');
      }
    }
  });

  it('declare the same placeholders in every language', () => {
    for (const catalog of Object.values(catalogs)) {
      for (const key of englishKeys) {
        const source = catalogs.en?.[key];
        const translated = catalog[key];
        if (!source || !translated) continue;
        expect(placeholderNames(translated)).toEqual(placeholderNames(source));
      }
    }
  });

  it('contain every key the extension pages ask for', () => {
    const pages: Record<string, string> = { guide: guidePage, popup: popupPage, setup: setupPage };
    for (const [page, html] of Object.entries(pages)) {
      const keys = [...html.matchAll(/data-i18n(?:-title)?="([^"]+)"/g)].map((match) => match[1] ?? '');
      expect(keys.length, page).toBeGreaterThan(0);
      for (const key of keys) {
        expect(Object.keys(english), `${page} uses ${key}`).toContain(key);
      }
    }
  });

  it('only reference placeholders that are declared', () => {
    for (const catalog of Object.values(catalogs)) {
      for (const message of Object.values(catalog)) {
        expect(referencedPlaceholders(message)).toEqual(placeholderNames(message));
      }
    }
  });
});
