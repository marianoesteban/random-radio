import { Component, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { AudioPlayer, AudioPlayerState } from './components/audio-player/audio-player';
import { FavoritesMenu } from './components/favorites-menu/favorites-menu';
import { PlayerStatus } from './components/player-status/player-status';
import { StationCard } from './components/station-card/station-card';
import { RadioBrowser, RadioStation } from './services/radio-browser';

@Component({
  selector: 'app-root',
  imports: [AudioPlayer, FavoritesMenu, PlayerStatus, StationCard],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly radioBrowser = inject(RadioBrowser);
  private readonly title = inject(Title);
  private readonly defaultPageTitle = this.title.getTitle();
  private readonly favoritesStorageKey = 'random-radio:favorites';

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
  protected readonly favoriteStations = signal<RadioStation[]>(this.loadFavoriteStations());
  protected readonly statusError = computed(() => this.error() || this.playerState().error);
  protected readonly isStatusPlaying = computed(() =>
    this.isLoading() ? false : this.playerState().isPlaying,
  );
  protected readonly isStatusTuning = computed(() =>
    this.isLoading() ? false : this.playerState().isTuning,
  );
  protected readonly isCurrentStationFavorite = computed(() => {
    const stationUuid = this.station()?.stationuuid;

    return stationUuid
      ? this.favoriteStations().some((favorite) => favorite.stationuuid === stationUuid)
      : false;
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
    const isFavorite = this.favoriteStations().some(
      (favorite) => favorite.stationuuid === station.stationuuid,
    );

    if (isFavorite) {
      this.favoriteStations.update((favorites) =>
        favorites.filter((favorite) => favorite.stationuuid !== station.stationuuid),
      );
    } else {
      this.favoriteStations.update((favorites) => [station, ...favorites]);
    }

    this.saveFavoriteStations();
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

  private loadFavoriteStations(): RadioStation[] {
    try {
      const favorites = JSON.parse(
        localStorage.getItem(this.favoritesStorageKey) ?? '[]',
      ) as unknown;

      if (!Array.isArray(favorites)) {
        return [];
      }

      return favorites.filter((favorite): favorite is RadioStation =>
        this.isRadioStation(favorite),
      );
    } catch {
      return [];
    }
  }

  private saveFavoriteStations(): void {
    try {
      localStorage.setItem(this.favoritesStorageKey, JSON.stringify(this.favoriteStations()));
    } catch {
      this.error.set('Favorites could not be saved in this browser.');
    }
  }

  private isRadioStation(value: unknown): value is RadioStation {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const station = value as Record<string, unknown>;

    return (
      typeof station['stationuuid'] === 'string' &&
      typeof station['name'] === 'string' &&
      typeof station['url'] === 'string' &&
      typeof station['url_resolved'] === 'string' &&
      typeof station['homepage'] === 'string' &&
      typeof station['favicon'] === 'string' &&
      typeof station['countrycode'] === 'string' &&
      typeof station['language'] === 'string' &&
      typeof station['tags'] === 'string' &&
      typeof station['codec'] === 'string' &&
      typeof station['bitrate'] === 'number'
    );
  }
}
