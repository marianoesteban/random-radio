import { Service } from '@angular/core';

const themeStorageKey = 'random-radio:theme';

export type Theme = 'light' | 'dark';

@Service()
export class ThemeStorage {
  load(): Theme | null {
    try {
      const theme = localStorage.getItem(themeStorageKey);

      return theme === 'light' || theme === 'dark' ? theme : null;
    } catch {
      return null;
    }
  }

  save(theme: Theme): void {
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {
      // The selected theme still applies for the current session.
    }
  }
}
