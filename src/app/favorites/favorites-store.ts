import { inject, Service, signal } from '@angular/core';
import { RadioStation, radioStationId } from '../radio/radio-station';
import { FavoritesStorage } from './favorites-storage';

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
  private readonly storage = inject(FavoritesStorage);
  private readonly favoriteStations = signal<RadioStation[]>(
    this.storage.load().slice(0, maximumFavoriteStations),
  );

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

      if (this.storage.save(favorites)) {
        this.favoriteStations.set(favorites);
        return { success: true, action: 'removed' };
      }
      return { success: false, reason: 'persistence' };
    }

    if (currentFavorites.length >= maximumFavoriteStations) {
      return { success: false, reason: 'limit' };
    }

    const favorites = [station, ...currentFavorites];

    if (this.storage.save(favorites)) {
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

    if (!this.storage.save(favorites)) {
      return { success: false, reason: 'persistence' };
    }

    this.favoriteStations.set(favorites);
    return { success: true };
  }

  exportFavorites(): string {
    return this.storage.serialize(this.favoriteStations());
  }

  importFavorites(contents: string): FavoritesImportResult {
    const importedStations = this.storage.parse(contents);

    if (!importedStations) {
      return { success: false, reason: 'invalid' };
    }

    const existingIds = new Set(this.favoriteStations().map(radioStationId));
    const newStations: RadioStation[] = [];

    for (const station of importedStations) {
      if (!existingIds.has(radioStationId(station))) {
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

    if (!this.storage.save(favorites)) {
      return { success: false, reason: 'persistence' };
    }

    this.favoriteStations.set(favorites);

    return { success: true, imported: newStations.length, total: favorites.length };
  }
}
