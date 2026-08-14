import { Component, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { FavoritesMenu } from './components/favorites-menu/favorites-menu';
import {
  RadioStationPlaybackFailure,
  RadioStationPlayer,
} from './components/radio-station-player/radio-station-player';
import { RadioStation, RadioStationSource, radioStationId } from './models/radio-station';
import { FavoritesTransfer } from './services/favorites-transfer';
import { NotificationService } from './services/notification-service';
import { RadioStationService } from './services/radio-station-service';
import { ThemeService } from './services/theme';
import { LastPlayedStationStorage } from './storage/last-played-station-storage';
import { FavoritesStore, maximumFavoriteStations } from './stores/favorites-store';

type StationLoading =
  | { readonly kind: 'random' }
  | { readonly kind: 'favorite'; readonly stationId: string }
  | { readonly kind: 'restored' }
  | null;

@Component({
  selector: 'app-root',
  imports: [FavoritesMenu, RadioStationPlayer],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '[class.dark-theme]': 'theme.isDark()',
  },
})
export class App {
  private static readonly maxRandomPlaybackAttempts = 3;

  private readonly stationService = inject(RadioStationService);
  private readonly favoritesStore = inject(FavoritesStore);
  private readonly lastPlayedStationStorage = inject(LastPlayedStationStorage);
  private readonly title = inject(Title);
  private readonly defaultPageTitle = this.title.getTitle();
  private currentSelection: 'random' | 'other' = 'other';
  private randomPlaybackAttempts = 0;
  private hasCurrentStationPlayed = false;

  protected readonly station = signal<RadioStation | null>(this.lastPlayedStationStorage.load());
  protected readonly shouldAutoplayStation = signal(false);
  private readonly stationLoading = signal<StationLoading>(null);
  protected readonly isSelectionLoading = computed(() => {
    const loading = this.stationLoading();

    return loading !== null && loading.kind !== 'restored';
  });
  protected readonly isStationLoading = computed(() => this.stationLoading() !== null);
  protected readonly loadingFavoriteStationId = computed(() => {
    const loading = this.stationLoading();

    return loading?.kind === 'favorite' ? loading.stationId : null;
  });
  protected readonly stationError = signal('');
  protected readonly isFavoritesMenuOpen = signal(false);
  protected readonly notifications = inject(NotificationService);
  protected readonly favoritesTransfer = inject(FavoritesTransfer);
  protected readonly theme = inject(ThemeService);
  protected readonly favoriteStations = this.favoritesStore.stations;
  protected readonly isCurrentStationFavorite = computed(() => {
    const station = this.station();

    return station ? this.favoritesStore.isFavorite(station) : false;
  });

  constructor() {
    const restoredStation = this.station();

    if (restoredStation) {
      this.updatePageTitle(restoredStation.name);
      void this.refreshRestoredStation(restoredStation);
    }
  }

  protected async playRandomStation(): Promise<void> {
    this.currentSelection = 'random';
    this.randomPlaybackAttempts = 0;
    await this.loadRandomStation(false);
  }

  protected handlePlaybackFailed(failure: RadioStationPlaybackFailure): void {
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
      this.stationError.set('');
      return;
    }

    if (this.hasCurrentStationPlayed) {
      this.stationError.set('Could not reconnect to this station. Press play to try again.');
      return;
    }

    if (this.randomPlaybackAttempts >= App.maxRandomPlaybackAttempts) {
      this.stationError.set('Could not find a playable station. Try again.');
      return;
    }

    void this.loadRandomStation(true);
  }

  private async loadRandomStation(isRetry: boolean): Promise<void> {
    const loading = { kind: 'random' } as const;
    this.stationLoading.set(loading);
    this.stationError.set(isRetry ? 'That station did not respond. Trying another...' : '');

    try {
      const station = await this.stationService.getRandomStation();

      this.randomPlaybackAttempts += 1;
      this.selectStation(station);
    } catch {
      this.stationError.set(
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

      this.station.set({ ...currentStation });
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

  protected toggleFavoritesMenu(): void {
    if (this.isFavoritesMenuOpen()) {
      this.favoritesTransfer.clearMessage();
    }

    this.isFavoritesMenuOpen.update((isOpen) => !isOpen);
  }

  protected toggleTheme(): void {
    this.theme.toggle();
  }

  protected toggleFavoriteStation(station: RadioStation): void {
    const result = this.favoritesStore.toggle(station);

    if (result.success) {
      this.notifications.clear();
      return;
    }

    this.notifications.show(
      result.reason === 'limit'
        ? `You can save up to ${maximumFavoriteStations} favorite stations.`
        : 'Favorites could not be saved in this browser.',
    );
  }

  protected async playFavoriteStation(station: RadioStation): Promise<void> {
    this.currentSelection = 'other';
    this.stationError.set('');
    const loading = { kind: 'favorite', stationId: radioStationId(station) } as const;
    this.stationLoading.set(loading);

    try {
      const canRefresh = this.stationService.canRefresh(station.source);
      const currentStation = await this.stationService.refreshStation(station);

      if (canRefresh) {
        void this.favoritesStore.update(currentStation);
      }
      this.notifications.clear();

      this.selectStation(currentStation);
      this.favoritesTransfer.clearMessage();
      this.isFavoritesMenuOpen.set(false);
    } catch {
      this.stationError.set('The favorite station could not be loaded. Try again.');
    } finally {
      if (this.stationLoading() === loading) {
        this.stationLoading.set(null);
      }
    }
  }

  protected handlePlaybackStarted(source: RadioStationSource): void {
    const station = this.station();

    if (station && this.isSourceForCurrentStation(source)) {
      this.hasCurrentStationPlayed = true;
      this.lastPlayedStationStorage.save(station);
    }

    if (station && this.currentSelection === 'random' && this.isSourceForCurrentStation(source)) {
      this.randomPlaybackAttempts = 1;
      this.stationError.set('');
    }

    this.stationService.reportPlayback(source).catch(() => undefined);
  }

  private updatePageTitle(stationName: string): void {
    const name = stationName.trim();

    this.title.setTitle(name ? `Random Radio - ${name}` : this.defaultPageTitle);
  }

  private selectStation(station: RadioStation): void {
    this.hasCurrentStationPlayed = false;
    this.shouldAutoplayStation.set(true);
    this.station.set({ ...station });
    this.updatePageTitle(station.name);
  }

  private isSourceForCurrentStation(source: RadioStationSource): boolean {
    const stationSource = this.station()?.source;

    return (
      stationSource?.provider === source.provider && stationSource.externalId === source.externalId
    );
  }
}
