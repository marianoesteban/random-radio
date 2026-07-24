import { Service } from '@angular/core';
import { parseRadioStation, RadioStation } from '../models/radio-station';

interface StoredLastPlayedStation {
  readonly version: 1;
  readonly station: RadioStation;
}

@Service()
export class LastPlayedStationStorage {
  private readonly storageKey = 'random-radio:last-station';

  load(): RadioStation | null {
    try {
      const storedValue = JSON.parse(localStorage.getItem(this.storageKey) ?? 'null') as unknown;

      if (!storedValue || typeof storedValue !== 'object') {
        return null;
      }

      const value = storedValue as Record<string, unknown>;

      return value['version'] === 1 ? parseRadioStation(value['station']) : null;
    } catch {
      return null;
    }
  }

  save(station: RadioStation): void {
    try {
      const storedValue: StoredLastPlayedStation = { version: 1, station };

      localStorage.setItem(this.storageKey, JSON.stringify(storedValue));
    } catch {
      // Playback should continue when browser storage is unavailable.
    }
  }
}
