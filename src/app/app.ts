import { Component, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { AudioPlayer, AudioPlayerState } from './components/audio-player/audio-player';
import { FavoritesMenu } from './components/favorites-menu/favorites-menu';
import { PlayerStatus } from './components/player-status/player-status';
import { StationCard } from './components/station-card/station-card';
import { RadioBrowser, RadioStation } from './services/radio-browser';
import { FavoritesStore } from './stores/favorites-store';

@Component({
  selector: 'app-root',
  imports: [AudioPlayer, FavoritesMenu, PlayerStatus, StationCard],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly radioBrowser = inject(RadioBrowser);
  private readonly favoritesStore = inject(FavoritesStore);
  private readonly title = inject(Title);
  private readonly defaultPageTitle = this.title.getTitle();

  protected readonly station = signal<RadioStation | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly error = signal('');
  protected readonly playRequestId = signal(0);
  protected readonly playerState = signal<AudioPlayerState>({
    isPlaying: false,
    isTuning: false,
    error: '',
  });
  protected readonly isFavoritesMenuOpen = signal(false);
  protected readonly favoriteStations = this.favoritesStore.stations;
  protected readonly statusError = computed(
    () => this.error() || this.favoritesStore.persistenceError() || this.playerState().error,
  );
  protected readonly isStatusPlaying = computed(() =>
    this.isLoading() ? false : this.playerState().isPlaying,
  );
  protected readonly isStatusTuning = computed(() =>
    this.isLoading() ? false : this.playerState().isTuning,
  );
  protected readonly isCurrentStationFavorite = computed(() => {
    const stationUuid = this.station()?.stationuuid;

    return stationUuid ? this.favoritesStore.isFavorite(stationUuid) : false;
  });

  protected async playRandomStation(): Promise<void> {
    this.isLoading.set(true);
    this.error.set('');
    this.resetPlayerState();

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
    this.isFavoritesMenuOpen.update((isOpen) => !isOpen);
  }

  protected toggleFavoriteStation(station: RadioStation): void {
    this.favoritesStore.toggle(station);
  }

  protected playFavoriteStation(station: RadioStation): void {
    this.error.set('');
    this.selectStation(station);
    this.isFavoritesMenuOpen.set(false);
  }

  protected handlePlayerStateChange(state: AudioPlayerState): void {
    this.playerState.set(state);
  }

  private updatePageTitle(stationName: string): void {
    const name = stationName.trim();

    this.title.setTitle(name ? `Random Radio - ${name}` : this.defaultPageTitle);
  }

  private selectStation(station: RadioStation): void {
    this.playerState.set({ isPlaying: false, isTuning: true, error: '' });
    this.station.set(station);
    this.updatePageTitle(station.name);
    this.playRequestId.update((id) => id + 1);
  }

  private resetPlayerState(): void {
    this.playerState.set({ isPlaying: false, isTuning: false, error: '' });
  }
}
