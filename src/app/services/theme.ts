import { DOCUMENT, inject, Service, signal } from '@angular/core';

const THEME_STORAGE_KEY = 'random-radio:theme';

type Theme = 'light' | 'dark';

@Service()
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly isDark = signal(this.loadTheme() === 'dark');

  toggle(): void {
    const theme: Theme = this.isDark() ? 'light' : 'dark';

    this.isDark.set(theme === 'dark');
    this.saveTheme(theme);
  }

  private loadTheme(): Theme {
    const view = this.document.defaultView;

    try {
      const savedTheme = view?.localStorage.getItem(THEME_STORAGE_KEY);

      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
    } catch {
      // Storage can be unavailable in privacy-restricted browsing contexts.
    }

    return view?.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private saveTheme(theme: Theme): void {
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The selected theme still applies for the current session.
    }
  }
}
