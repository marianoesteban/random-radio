import { Service, signal } from '@angular/core';
import { RadioStation, radioStationId } from '../models/radio-station';

interface StoredFavorites {
  readonly version: 1;
  readonly stations: RadioStation[];
}

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
        .map((favorite) => this.toRadioStation(favorite))
        .filter((favorite): favorite is RadioStation => favorite !== null);
    } catch {
      return [];
    }
  }

  private save(favorites: RadioStation[]): void {
    try {
      const storedFavorites: StoredFavorites = {
        version: 1,
        stations: favorites,
      };

      localStorage.setItem(this.storageKey, JSON.stringify(storedFavorites));
      this.storageError.set('');
    } catch {
      this.storageError.set('Favorites could not be saved in this browser.');
    }
  }

  private toRadioStation(value: unknown): RadioStation | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const station = value as Record<string, unknown>;

    if (
      this.isRadioStationSource(station['source']) &&
      typeof station['name'] === 'string' &&
      typeof station['streamUrl'] === 'string' &&
      typeof station['homepageUrl'] === 'string' &&
      typeof station['imageUrl'] === 'string' &&
      typeof station['countryCode'] === 'string'
    ) {
      return {
        source: {
          provider: station['source'].provider,
          externalId: station['source'].externalId,
        },
        name: station['name'],
        streamUrl: station['streamUrl'],
        homepageUrl: station['homepageUrl'],
        imageUrl: station['imageUrl'],
        countryCode: station['countryCode'],
      };
    }

    return null;
  }

  private isRadioStationSource(value: unknown): value is RadioStation['source'] {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const source = value as Record<string, unknown>;

    return typeof source['provider'] === 'string' && typeof source['externalId'] === 'string';
  }
}
