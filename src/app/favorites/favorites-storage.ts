import { Service } from '@angular/core';
import { parseRadioStation, RadioStation } from '../radio/radio-station';

interface StoredFavorites {
  readonly version: 1;
  readonly stations: RadioStation[];
}

@Service()
export class FavoritesStorage {
  private readonly storageKey = 'random-radio:favorites';

  load(): RadioStation[] {
    try {
      const storedFavorites = JSON.parse(
        localStorage.getItem(this.storageKey) ?? 'null',
      ) as unknown;

      if (!this.isStoredFavorites(storedFavorites)) {
        return [];
      }

      return storedFavorites.stations
        .map(parseRadioStation)
        .filter((station): station is RadioStation => station !== null);
    } catch {
      return [];
    }
  }

  save(stations: RadioStation[]): boolean {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.toStoredFavorites(stations)));
      return true;
    } catch {
      return false;
    }
  }

  serialize(stations: RadioStation[]): string {
    return JSON.stringify(this.toStoredFavorites(stations), null, 2);
  }

  parse(contents: string): RadioStation[] | null {
    let storedFavorites: unknown;

    try {
      storedFavorites = JSON.parse(contents) as unknown;
    } catch {
      return null;
    }

    if (!this.isStoredFavorites(storedFavorites)) {
      return null;
    }

    const stations = storedFavorites.stations.map(parseRadioStation);

    return stations.some((station) => station === null)
      ? null
      : stations.filter((station): station is RadioStation => station !== null);
  }

  private isStoredFavorites(value: unknown): value is StoredFavorites {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const storedFavorites = value as Record<string, unknown>;

    return storedFavorites['version'] === 1 && Array.isArray(storedFavorites['stations']);
  }

  private toStoredFavorites(stations: RadioStation[]): StoredFavorites {
    return { version: 1, stations };
  }
}
