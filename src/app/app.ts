import { Component, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { FavoritesMenu } from './components/favorites-menu/favorites-menu';
import { RadioStationPlayer } from './components/radio-station-player/radio-station-player';
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
  private readonly radioBrowser = inject(RadioBrowser);
  private readonly favoritesStore = inject(FavoritesStore);
  private readonly lastPlayedStationStorage = inject(LastPlayedStationStorage);
  private readonly title = inject(Title);
  private readonly defaultPageTitle = this.title.getTitle();

  protected readonly station = signal<RadioStation | null>(this.lastPlayedStationStorage.load());
  protected readonly shouldAutoplayStation = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly error = signal('');
  protected readonly isFavoritesMenuOpen = signal(false);
  protected readonly favoritesTransfer = inject(FavoritesTransfer);
  protected readonly theme = inject(ThemeService);
  protected readonly favoriteStations = this.favoritesStore.stations;
  protected readonly statusError = computed(
    () => this.error() || this.favoritesStore.persistenceError(),
  );
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
    this.isLoading.set(true);
    this.error.set('');

    try {
      const station = await this.radioBrowser.getRandomStation();

      this.selectStation(station);
    } catch {
      this.error.set('The station could not be played. Try another one.');
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
    this.error.set('');
    this.selectStation(station);
    this.favoritesTransfer.clearMessage();
    this.isFavoritesMenuOpen.set(false);
  }

  protected handlePlaybackStarted(source: RadioStationSource): void {
    const station = this.station();

    if (station) {
      this.lastPlayedStationStorage.save(station);
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
}
