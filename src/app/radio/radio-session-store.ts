import { computed, inject, Service, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { FavoritesStore } from '../favorites/favorites-store';
import { LastPlayedStationStorage } from './last-played-station-storage';
import { RadioStation, RadioStationSource, radioStationId } from './radio-station';
import { RadioStationService } from './radio-station-service';

type StationLoading =
  | { readonly kind: 'random' }
  | { readonly kind: 'favorite'; readonly stationId: string }
  | { readonly kind: 'restored' }
  | null;

interface StationPlaybackFailure {
  readonly source: RadioStationSource;
  readonly recovery: 'select-another-station' | 'user-action-required' | 'none';
}

@Service()
export class RadioSessionStore {
  private static readonly maxRandomPlaybackAttempts = 3;

  private readonly stationService = inject(RadioStationService);
  private readonly favoritesStore = inject(FavoritesStore);
  private readonly lastPlayedStationStorage = inject(LastPlayedStationStorage);
  private readonly title = inject(Title);
  private readonly defaultPageTitle = this.title.getTitle();
  private readonly stationLoading = signal<StationLoading>(null);
  private readonly currentStation = signal<RadioStation | null>(
    this.lastPlayedStationStorage.load(),
  );
  private readonly autoplayStation = signal(false);
  private readonly selectionError = signal('');
  private currentSelection: 'random' | 'other' = 'other';
  private randomPlaybackAttempts = 0;
  private hasCurrentStationPlayed = false;

  readonly station = this.currentStation.asReadonly();
  readonly shouldAutoplayStation = this.autoplayStation.asReadonly();
  readonly isSelectionLoading = computed(() => {
    const loading = this.stationLoading();

    return loading !== null && loading.kind !== 'restored';
  });
  readonly isStationLoading = computed(() => this.stationLoading() !== null);
  readonly loadingFavoriteStationId = computed(() => {
    const loading = this.stationLoading();

    return loading?.kind === 'favorite' ? loading.stationId : null;
  });
  readonly stationError = this.selectionError.asReadonly();

  constructor() {
    const restoredStation = this.station();

    if (restoredStation) {
      this.updatePageTitle(restoredStation.name);
      void this.refreshRestoredStation(restoredStation);
    }
  }

  async playRandomStation(): Promise<void> {
    this.currentSelection = 'random';
    this.randomPlaybackAttempts = 0;
    await this.loadRandomStation(false);
  }

  async playFavoriteStation(station: RadioStation): Promise<boolean> {
    this.currentSelection = 'other';
    this.selectionError.set('');
    const loading = { kind: 'favorite', stationId: radioStationId(station) } as const;
    this.stationLoading.set(loading);

    try {
      const canRefresh = this.stationService.canRefresh(station.source);
      let currentStation = station;
      let refreshSucceeded = false;

      try {
        currentStation = await this.stationService.refreshStation(station);
        refreshSucceeded = true;
      } catch {
        // Fall back to the persisted favorite when its provider is unavailable.
      }

      if (canRefresh && refreshSucceeded) {
        void this.favoritesStore.update(currentStation);
      }

      this.selectStation(currentStation);
      return true;
    } catch {
      this.selectionError.set('The favorite station could not be loaded. Try again.');
      return false;
    } finally {
      if (this.stationLoading() === loading) {
        this.stationLoading.set(null);
      }
    }
  }

  handlePlaybackFailed(failure: StationPlaybackFailure): void {
    const station = this.station();

    if (
      !station ||
      !this.isSourceForCurrentStation(failure.source) ||
      this.currentSelection !== 'random' ||
      this.isSelectionLoading()
    ) {
      return;
    }

    if (failure.recovery !== 'select-another-station') {
      this.selectionError.set('');
      return;
    }

    if (this.hasCurrentStationPlayed) {
      this.selectionError.set('Could not reconnect to this station. Press play to try again.');
      return;
    }

    if (this.randomPlaybackAttempts >= RadioSessionStore.maxRandomPlaybackAttempts) {
      this.selectionError.set('Could not find a playable station. Try again.');
      return;
    }

    void this.loadRandomStation(true);
  }

  handlePlaybackStarted(source: RadioStationSource): void {
    const station = this.station();

    if (station && this.isSourceForCurrentStation(source)) {
      this.hasCurrentStationPlayed = true;
      this.lastPlayedStationStorage.save(station);
    }

    if (station && this.currentSelection === 'random' && this.isSourceForCurrentStation(source)) {
      this.randomPlaybackAttempts = 1;
      this.selectionError.set('');
    }

    this.stationService.reportPlayback(source).catch(() => undefined);
  }

  private async loadRandomStation(isRetry: boolean): Promise<void> {
    const loading = { kind: 'random' } as const;
    this.stationLoading.set(loading);
    this.selectionError.set(isRetry ? 'That station did not respond. Trying another...' : '');

    try {
      const station = await this.stationService.getRandomStation();

      this.randomPlaybackAttempts += 1;
      this.selectStation(station);
    } catch {
      this.selectionError.set(
        isRetry
          ? 'Could not find a playable station. Try again.'
          : 'The station could not be played. Try another one.',
      );
    } finally {
      if (this.stationLoading() === loading) {
        this.stationLoading.set(null);
      }
    }
  }

  private async refreshRestoredStation(station: RadioStation): Promise<void> {
    if (!this.stationService.canRefresh(station.source)) {
      return;
    }

    const loading = { kind: 'restored' } as const;
    this.stationLoading.set(loading);

    try {
      const currentStation = await this.stationService.refreshStation(station);

      if (this.stationLoading() !== loading) {
        return;
      }

      this.currentStation.set({ ...currentStation });
      this.updatePageTitle(currentStation.name);
      this.lastPlayedStationStorage.save(currentStation);

      if (this.favoritesStore.isFavorite(station)) {
        void this.favoritesStore.update(currentStation);
      }
    } catch {
      // Keep the stored station available when current data cannot be loaded.
    } finally {
      if (this.stationLoading() === loading) {
        this.stationLoading.set(null);
      }
    }
  }

  private updatePageTitle(stationName: string): void {
    const name = stationName.trim();

    this.title.setTitle(name ? `Random Radio - ${name}` : this.defaultPageTitle);
  }

  private selectStation(station: RadioStation): void {
    this.hasCurrentStationPlayed = false;
    this.autoplayStation.set(true);
    this.currentStation.set({ ...station });
    this.updatePageTitle(station.name);
  }

  private isSourceForCurrentStation(source: RadioStationSource): boolean {
    const stationSource = this.station()?.source;

    return (
      stationSource?.provider === source.provider && stationSource.externalId === source.externalId
    );
  }
}
