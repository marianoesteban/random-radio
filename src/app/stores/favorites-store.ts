import { Service, signal } from '@angular/core';
import { parseRadioStation, RadioStation, radioStationId } from '../models/radio-station';

interface StoredFavorites {
  readonly version: 1;
  readonly stations: RadioStation[];
}

export const maximumFavoriteStations = 500;

export type FavoritesImportResult =
  | { readonly success: true; readonly imported: number; readonly total: number }
  | { readonly success: false; readonly reason: 'invalid' | 'limit' | 'persistence' };

export type FavoriteToggleResult =
  | { readonly success: true; readonly action: 'added' | 'removed' }
  | { readonly success: false; readonly reason: 'limit' | 'persistence' };

export type FavoriteUpdateResult =
  | { readonly success: true }
  | { readonly success: false; readonly reason: 'not-found' | 'persistence' };

@Service()
export class FavoritesStore {
  private readonly storageKey = 'random-radio:favorites';
  private readonly favoriteStations = signal<RadioStation[]>(this.load());

  readonly stations = this.favoriteStations.asReadonly();

  isFavorite(station: RadioStation): boolean {
    const stationId = radioStationId(station);

    return this.favoriteStations().some((favorite) => radioStationId(favorite) === stationId);
  }

  toggle(station: RadioStation): FavoriteToggleResult {
    const stationId = radioStationId(station);
    const currentFavorites = this.favoriteStations();

    if (this.isFavorite(station)) {
      const favorites = currentFavorites.filter(
        (favorite) => radioStationId(favorite) !== stationId,
      );

      if (this.save(favorites)) {
        this.favoriteStations.set(favorites);
        return { success: true, action: 'removed' };
      }
      return { success: false, reason: 'persistence' };
    }

    if (currentFavorites.length >= maximumFavoriteStations) {
      return { success: false, reason: 'limit' };
    }

    const favorites = [station, ...currentFavorites];

    if (this.save(favorites)) {
      this.favoriteStations.set(favorites);
      return { success: true, action: 'added' };
    }

    return { success: false, reason: 'persistence' };
  }

  update(station: RadioStation): FavoriteUpdateResult {
    const stationId = radioStationId(station);
    const currentFavorites = this.favoriteStations();

    if (!currentFavorites.some((favorite) => radioStationId(favorite) === stationId)) {
      return { success: false, reason: 'not-found' };
    }

    const favorites = currentFavorites.map((favorite) =>
      radioStationId(favorite) === stationId ? station : favorite,
    );

    if (!this.save(favorites)) {
      return { success: false, reason: 'persistence' };
    }

    this.favoriteStations.set(favorites);
    return { success: true };
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

    if (this.favoriteStations().length + newStations.length > maximumFavoriteStations) {
      return { success: false, reason: 'limit' };
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
        .filter((favorite): favorite is RadioStation => favorite !== null)
        .slice(0, maximumFavoriteStations);
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
      return true;
    } catch {
      return false;
    }
  }
}
