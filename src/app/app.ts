import { Component, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { FavoritesMenu } from './components/favorites-menu/favorites-menu';
import {
  RadioStationPlaybackFailure,
  RadioStationPlayer,
} from './components/radio-station-player/radio-station-player';
import { RadioStation, RadioStationSource } from './models/radio-station';
import { FavoritesTransfer } from './services/favorites-transfer';
import { RadioBrowser } from './services/radio-browser';
import { ThemeService } from './services/theme';
import { LastPlayedStationStorage } from './storage/last-played-station-storage';
import { FavoritesStore } from './stores/favorites-store';

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

  private readonly radioBrowser = inject(RadioBrowser);
  private readonly favoritesStore = inject(FavoritesStore);
  private readonly lastPlayedStationStorage = inject(LastPlayedStationStorage);
  private readonly title = inject(Title);
  private readonly defaultPageTitle = this.title.getTitle();
  private currentSelection: 'random' | 'other' = 'other';
  private randomPlaybackAttempts = 0;

  protected readonly station = signal<RadioStation | null>(this.lastPlayedStationStorage.load());
  protected readonly shouldAutoplayStation = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly stationError = signal('');
  protected readonly isFavoritesMenuOpen = signal(false);
  protected readonly favoritesTransfer = inject(FavoritesTransfer);
  protected readonly theme = inject(ThemeService);
  protected readonly favoriteStations = this.favoritesStore.stations;
  protected readonly favoritePersistenceError = this.favoritesStore.persistenceError;
  protected readonly isCurrentStationFavorite = computed(() => {
    const station = this.station();

    return station ? this.favoritesStore.isFavorite(station) : false;
  });

  constructor() {
    const restoredStation = this.station();

    if (restoredStation) {
      this.updatePageTitle(restoredStation.name);
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
      this.isLoading()
    ) {
      return;
    }

    if (failure.recovery !== 'select-another-station') {
      this.stationError.set('');
      return;
    }

    if (this.randomPlaybackAttempts >= App.maxRandomPlaybackAttempts) {
      this.stationError.set('Could not find a playable station. Try again.');
      return;
    }

    void this.loadRandomStation(true);
  }

  private async loadRandomStation(isRetry: boolean): Promise<void> {
    this.isLoading.set(true);
    this.stationError.set(isRetry ? 'That station did not respond. Trying another...' : '');

    try {
      const station = await this.radioBrowser.getRandomStation();

      this.randomPlaybackAttempts += 1;
      this.selectStation(station);
    } catch {
      this.stationError.set(
        isRetry
          ? 'Could not find a playable station. Try again.'
          : 'The station could not be played. Try another one.',
      );
    } finally {
      this.isLoading.set(false);
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
    this.favoritesStore.toggle(station);
  }

  protected playFavoriteStation(station: RadioStation): void {
    this.currentSelection = 'other';
    this.stationError.set('');
    this.selectStation(station);
    this.favoritesTransfer.clearMessage();
    this.isFavoritesMenuOpen.set(false);
  }

  protected handlePlaybackStarted(source: RadioStationSource): void {
    const station = this.station();

    if (station) {
      this.lastPlayedStationStorage.save(station);
    }

    if (station && this.currentSelection === 'random' && this.isSourceForCurrentStation(source)) {
      this.randomPlaybackAttempts = 1;
      this.stationError.set('');
    }

    if (source.provider !== RadioBrowser.provider) {
      return;
    }

    this.radioBrowser.reportStationClick(source.externalId).catch(() => undefined);
  }

  private updatePageTitle(stationName: string): void {
    const name = stationName.trim();

    this.title.setTitle(name ? `Random Radio - ${name}` : this.defaultPageTitle);
  }

  private selectStation(station: RadioStation): void {
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
