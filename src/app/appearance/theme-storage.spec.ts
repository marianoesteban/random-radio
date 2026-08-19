import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ThemeStorage } from './theme-storage';

const storageKey = 'random-radio:theme';

describe('ThemeStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['light', 'dark'] as const)('loads a saved %s theme', (theme) => {
    localStorage.setItem(storageKey, theme);

    expect(TestBed.inject(ThemeStorage).load()).toBe(theme);
  });

  it('returns no theme when the saved value is invalid', () => {
    localStorage.setItem(storageKey, 'sepia');

    expect(TestBed.inject(ThemeStorage).load()).toBeNull();
  });

  it('returns no theme when browser storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage is unavailable');
    });

    expect(TestBed.inject(ThemeStorage).load()).toBeNull();
  });

  it('saves the selected theme', () => {
    TestBed.inject(ThemeStorage).save('dark');

    expect(localStorage.getItem(storageKey)).toBe('dark');
  });

  it('does not throw when browser storage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is unavailable');
    });

    expect(() => TestBed.inject(ThemeStorage).save('dark')).not.toThrow();
  });
});
