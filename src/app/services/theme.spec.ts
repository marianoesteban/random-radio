import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeService } from './theme';

function setPreferredColorScheme(isDark: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: isDark,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    setPreferredColorScheme(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function createService(): ThemeService {
    return TestBed.inject(ThemeService);
  }

  it.each([
    ['light', false],
    ['dark', true],
  ] as const)('should restore the saved %s theme', (theme, expectedIsDark) => {
    localStorage.setItem('random-radio:theme', theme);

    expect(createService().isDark()).toBe(expectedIsDark);
  });

  it('should use the preferred color scheme when no theme is saved', () => {
    setPreferredColorScheme(true);

    expect(createService().isDark()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });

  it('should ignore an invalid saved theme and use the preferred color scheme', () => {
    localStorage.setItem('random-radio:theme', 'sepia');
    setPreferredColorScheme(true);

    expect(createService().isDark()).toBe(true);
  });

  it('should persist theme changes', () => {
    const service = createService();

    service.toggle();

    expect(service.isDark()).toBe(true);
    expect(localStorage.getItem('random-radio:theme')).toBe('dark');

    service.toggle();

    expect(service.isDark()).toBe(false);
    expect(localStorage.getItem('random-radio:theme')).toBe('light');
  });

  it('should use the preferred color scheme when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage is unavailable');
    });
    setPreferredColorScheme(true);

    expect(createService().isDark()).toBe(true);
  });

  it('should still apply a theme change when storage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is unavailable');
    });
    const service = createService();

    expect(() => service.toggle()).not.toThrow();
    expect(service.isDark()).toBe(true);
  });
});
