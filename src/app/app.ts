import { Component, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import {
  AudioPlayer,
  AudioPlayerError,
  AudioPlayerState,
  AudioSource,
} from './components/audio-player/audio-player';
import { FavoritesMenu } from './components/favorites-menu/favorites-menu';
import { PlayerStatus } from './components/player-status/player-status';
import { StationCard } from './components/station-card/station-card';
import { RadioBrowser, RadioStation } from './services/radio-browser';
import { FavoritesStore } from './stores/favorites-store';

interface StationSelection {
  readonly station: RadioStation;
  readonly source: AudioSource;
}

const audioPlayerErrorMessages: Record<AudioPlayerError, string> = {
  'player-unavailable': 'The audio player is not available.',
  'playback-failed': 'The station could not be played. Try another one.',
  'stream-failed': 'This stream stopped responding. Try another station.',
};

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

  protected readonly selection = signal<StationSelection | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly error = signal('');
  protected readonly playerState = signal<AudioPlayerState>({
    isPlaying: false,
    isBuffering: false,
    error: null,
  });
  protected readonly isFavoritesMenuOpen = signal(false);
  protected readonly favoriteStations = this.favoritesStore.stations;
  protected readonly statusError = computed(() => {
    const playerError = this.playerState().error;

    return (
      this.error() ||
      this.favoritesStore.persistenceError() ||
      (playerError ? audioPlayerErrorMessages[playerError] : '')
    );
  });
  protected readonly isStatusPlaying = computed(() =>
    this.isLoading() ? false : this.playerState().isPlaying,
  );
  protected readonly isStatusTuning = computed(() =>
    this.isLoading() ? false : this.playerState().isBuffering,
  );
  protected readonly isCurrentStationFavorite = computed(() => {
    const stationUuid = this.selection()?.station.stationuuid;

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

    const currentStation = this.selection()?.station;
    const isCurrentStationPlaying =
      currentStation?.stationuuid === station.stationuuid && this.playerState().isPlaying;

    if (!isCurrentStationPlaying) {
      this.selectStation(station);
    }

    this.isFavoritesMenuOpen.set(false);
  }

  protected handlePlayerStateChange(state: AudioPlayerState): void {
    this.playerState.set(state);
  }

  protected handlePlaybackStarted(stationUuid: string): void {
    this.radioBrowser.reportStationClick(stationUuid).catch(() => undefined);
  }

  private updatePageTitle(stationName: string): void {
    const name = stationName.trim();

    this.title.setTitle(name ? `Random Radio - ${name}` : this.defaultPageTitle);
  }

  private selectStation(station: RadioStation): void {
    this.playerState.set({ isPlaying: false, isBuffering: true, error: null });
    this.selection.set({
      station,
      source: { url: this.radioBrowser.streamUrl(station) },
    });
    this.updatePageTitle(station.name);
  }

  private resetPlayerState(): void {
    this.playerState.set({ isPlaying: false, isBuffering: false, error: null });
  }
}
