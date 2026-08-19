import { TestBed } from '@angular/core/testing';
import { type Mock, vi } from 'vitest';
import { ThemeService } from './theme';
import { Theme, ThemeStorage } from './theme-storage';

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
  let storage: {
    load: Mock<() => Theme | null>;
    save: Mock<(theme: Theme) => void>;
  };

  beforeEach(() => {
    storage = {
      load: vi.fn(() => null),
      save: vi.fn(),
    };
    setPreferredColorScheme(false);
    TestBed.configureTestingModule({
      providers: [{ provide: ThemeStorage, useValue: storage }],
    });
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
    storage.load.mockReturnValue(theme);

    expect(createService().isDark()).toBe(expectedIsDark);
  });

  it('should use the preferred color scheme when no theme is saved', () => {
    setPreferredColorScheme(true);

    expect(createService().isDark()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });

  it('should persist theme changes', () => {
    const service = createService();

    service.toggle();

    expect(service.isDark()).toBe(true);
    expect(storage.save).toHaveBeenLastCalledWith('dark');

    service.toggle();

    expect(service.isDark()).toBe(false);
    expect(storage.save).toHaveBeenLastCalledWith('light');
  });
});
