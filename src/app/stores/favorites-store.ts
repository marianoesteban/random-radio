import { Service, signal } from '@angular/core';
import { RadioStation } from '../services/radio-browser';

@Service()
export class FavoritesStore {
  private readonly storageKey = 'random-radio:favorites';
  private readonly favoriteStations = signal<RadioStation[]>(this.load());
  private readonly storageError = signal('');

  readonly stations = this.favoriteStations.asReadonly();
  readonly persistenceError = this.storageError.asReadonly();

  isFavorite(stationUuid: string): boolean {
    return this.favoriteStations().some((station) => station.stationuuid === stationUuid);
  }

  toggle(station: RadioStation): void {
    const favorites = this.isFavorite(station.stationuuid)
      ? this.favoriteStations().filter((favorite) => favorite.stationuuid !== station.stationuuid)
      : [station, ...this.favoriteStations()];

    this.favoriteStations.set(favorites);
    this.save(favorites);
  }

  private load(): RadioStation[] {
    try {
      const favorites = JSON.parse(localStorage.getItem(this.storageKey) ?? '[]') as unknown;

      if (!Array.isArray(favorites)) {
        return [];
      }

      return favorites.filter((favorite): favorite is RadioStation =>
        this.isRadioStation(favorite),
      );
    } catch {
      return [];
    }
  }

  private save(favorites: RadioStation[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(favorites));
      this.storageError.set('');
    } catch {
      this.storageError.set('Favorites could not be saved in this browser.');
    }
  }

  private isRadioStation(value: unknown): value is RadioStation {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const station = value as Record<string, unknown>;

    return (
      typeof station['stationuuid'] === 'string' &&
      typeof station['name'] === 'string' &&
      typeof station['url'] === 'string' &&
      typeof station['url_resolved'] === 'string' &&
      typeof station['homepage'] === 'string' &&
      typeof station['favicon'] === 'string' &&
      typeof station['countrycode'] === 'string' &&
      typeof station['language'] === 'string' &&
      typeof station['tags'] === 'string' &&
      typeof station['codec'] === 'string' &&
      typeof station['bitrate'] === 'number'
    );
  }
}
