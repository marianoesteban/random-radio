import { Service, signal } from '@angular/core';
import { parseRadioStation, RadioStation, radioStationId } from '../models/radio-station';

interface StoredFavorites {
  readonly version: 1;
  readonly stations: RadioStation[];
}

export type FavoritesImportResult =
  | { readonly success: true; readonly imported: number; readonly total: number }
  | { readonly success: false; readonly reason: 'invalid' | 'persistence' };

@Service()
export class FavoritesStore {
  private readonly storageKey = 'random-radio:favorites';
  private readonly favoriteStations = signal<RadioStation[]>(this.load());
  private readonly storageError = signal('');

  readonly stations = this.favoriteStations.asReadonly();
  readonly persistenceError = this.storageError.asReadonly();

  isFavorite(station: RadioStation): boolean {
    const stationId = radioStationId(station);

    return this.favoriteStations().some((favorite) => radioStationId(favorite) === stationId);
  }

  toggle(station: RadioStation): void {
    const stationId = radioStationId(station);
    const favorites = this.isFavorite(station)
      ? this.favoriteStations().filter((favorite) => radioStationId(favorite) !== stationId)
      : [station, ...this.favoriteStations()];

    this.favoriteStations.set(favorites);
    this.save(favorites);
  }

  exportFavorites(): string {
    const storedFavorites: StoredFavorites = {
      version: 1,
      stations: this.favoriteStations(),
    };

    return JSON.stringify(storedFavorites, null, 2);
  }

  importFavorites(contents: string): FavoritesImportResult {
    let value: unknown;

    try {
      value = JSON.parse(contents) as unknown;
    } catch {
      return { success: false, reason: 'invalid' };
    }

    if (!value || typeof value !== 'object') {
      return { success: false, reason: 'invalid' };
    }

    const storedFavorites = value as Record<string, unknown>;

    if (storedFavorites['version'] !== 1 || !Array.isArray(storedFavorites['stations'])) {
      return { success: false, reason: 'invalid' };
    }

    const importedStations = storedFavorites['stations'].map(parseRadioStation);

    if (importedStations.some((station) => station === null)) {
      return { success: false, reason: 'invalid' };
    }

    const existingIds = new Set(this.favoriteStations().map(radioStationId));
    const newStations: RadioStation[] = [];

    for (const station of importedStations) {
      if (station && !existingIds.has(radioStationId(station))) {
        existingIds.add(radioStationId(station));
        newStations.push(station);
      }
    }

    if (newStations.length === 0) {
      return { success: true, imported: 0, total: this.favoriteStations().length };
    }

    const favorites = [...newStations, ...this.favoriteStations()];

    if (!this.save(favorites)) {
      return { success: false, reason: 'persistence' };
    }

    this.favoriteStations.set(favorites);

    return { success: true, imported: newStations.length, total: favorites.length };
  }

  private load(): RadioStation[] {
    try {
      const storedFavorites = JSON.parse(
        localStorage.getItem(this.storageKey) ?? 'null',
      ) as unknown;

      if (!storedFavorites || typeof storedFavorites !== 'object') {
        return [];
      }

      const value = storedFavorites as Record<string, unknown>;

      if (value['version'] !== 1 || !Array.isArray(value['stations'])) {
        return [];
      }

      return value['stations']
        .map(parseRadioStation)
        .filter((favorite): favorite is RadioStation => favorite !== null);
    } catch {
      return [];
    }
  }

  private save(favorites: RadioStation[]): boolean {
    try {
      const storedFavorites: StoredFavorites = {
        version: 1,
        stations: favorites,
      };

      localStorage.setItem(this.storageKey, JSON.stringify(storedFavorites));
      this.storageError.set('');
      return true;
    } catch {
      this.storageError.set('Favorites could not be saved in this browser.');
      return false;
    }
  }
}
