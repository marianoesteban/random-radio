import { Component, computed, inject, signal } from '@angular/core';
import { FavoritesMenu } from './components/favorites-menu/favorites-menu';
import {
  RadioStationPlaybackFailure,
  RadioStationPlayer,
} from './components/radio-station-player/radio-station-player';
import { RadioStation, RadioStationSource } from './models/radio-station';
import { FavoritesTransfer } from './services/favorites-transfer';
import { NotificationService } from './services/notification-service';
import { ThemeService } from './services/theme';
import { FavoritesStore, maximumFavoriteStations } from './stores/favorites-store';
import { RadioSessionStore } from './stores/radio-session-store';

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
  private readonly radioSession = inject(RadioSessionStore);
  private readonly favoritesStore = inject(FavoritesStore);
  protected readonly station = this.radioSession.station;
  protected readonly shouldAutoplayStation = this.radioSession.shouldAutoplayStation;
  protected readonly isSelectionLoading = this.radioSession.isSelectionLoading;
  protected readonly isStationLoading = this.radioSession.isStationLoading;
  protected readonly loadingFavoriteStationId = this.radioSession.loadingFavoriteStationId;
  protected readonly stationError = this.radioSession.stationError;
  protected readonly isFavoritesMenuOpen = signal(false);
  protected readonly notifications = inject(NotificationService);
  protected readonly favoritesTransfer = inject(FavoritesTransfer);
  protected readonly theme = inject(ThemeService);
  protected readonly favoriteStations = this.favoritesStore.stations;
  protected readonly isCurrentStationFavorite = computed(() => {
    const station = this.station();

    return station ? this.favoritesStore.isFavorite(station) : false;
  });

  protected async playRandomStation(): Promise<void> {
    await this.radioSession.playRandomStation();
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
    if (await this.radioSession.playFavoriteStation(station)) {
      this.notifications.clear();
      this.favoritesTransfer.clearMessage();
      this.isFavoritesMenuOpen.set(false);
    }
  }

  protected handlePlaybackStarted(source: RadioStationSource): void {
    this.radioSession.handlePlaybackStarted(source);
  }

  protected handlePlaybackFailed(failure: RadioStationPlaybackFailure): void {
    this.radioSession.handlePlaybackFailed(failure);
  }
}
