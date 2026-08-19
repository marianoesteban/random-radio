import { Service } from '@angular/core';

const volumeStorageKey = 'random-radio:volume';
const mutedStorageKey = 'random-radio:muted';

export interface AudioPreferences {
  readonly volume: number;
  readonly muted: boolean;
}

const defaultAudioPreferences: AudioPreferences = {
  volume: 1,
  muted: false,
};

@Service()
export class AudioPreferencesStorage {
  load(): AudioPreferences {
    try {
      const storedVolume = Number(localStorage.getItem(volumeStorageKey));
      const volume =
        Number.isFinite(storedVolume) && storedVolume > 0 && storedVolume <= 1
          ? storedVolume
          : defaultAudioPreferences.volume;

      return {
        volume,
        muted: localStorage.getItem(mutedStorageKey) === 'true',
      };
    } catch {
      return defaultAudioPreferences;
    }
  }

  saveVolume(volume: number): void {
    try {
      localStorage.setItem(volumeStorageKey, String(volume));
    } catch {
      // The selected volume still applies for the current session.
    }
  }

  saveMuted(muted: boolean): void {
    try {
      localStorage.setItem(mutedStorageKey, String(muted));
    } catch {
      // The selected mute state still applies for the current session.
    }
  }
}
