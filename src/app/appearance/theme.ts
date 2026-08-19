import { DOCUMENT, inject, Service, signal } from '@angular/core';
import { Theme, ThemeStorage } from './theme-storage';

@Service()
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(ThemeStorage);

  readonly isDark = signal(this.loadTheme() === 'dark');

  toggle(): void {
    const theme: Theme = this.isDark() ? 'light' : 'dark';

    this.isDark.set(theme === 'dark');
    this.storage.save(theme);
  }

  private loadTheme(): Theme {
    const savedTheme = this.storage.load();

    if (savedTheme) {
      return savedTheme;
    }

    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
}
