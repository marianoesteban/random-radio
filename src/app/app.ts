import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { AudioControls } from './components/audio-controls/audio-controls';
import { FavoritesMenu } from './components/favorites-menu/favorites-menu';
import { PlayerStatus } from './components/player-status/player-status';
import { StationCard } from './components/station-card/station-card';
import { RadioBrowser, RadioStation } from './radio-browser';

@Component({
  selector: 'app-root',
  imports: [AudioControls, FavoritesMenu, PlayerStatus, StationCard],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly radioBrowser = inject(RadioBrowser);
  private readonly title = inject(Title);
  private readonly defaultPageTitle = this.title.getTitle();
  private readonly audio = viewChild<ElementRef<HTMLAudioElement>>('audioPlayer');
  private readonly favoritesStorageKey = 'random-radio:favorites';

  protected readonly station = signal<RadioStation | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly isPlaying = signal(false);
  protected readonly isTuning = signal(false);
  protected readonly volume = signal(1);
  protected readonly error = signal('');
  protected readonly isFavoritesMenuOpen = signal(false);
  protected readonly favoriteStations = signal<RadioStation[]>(this.loadFavoriteStations());
  protected readonly isCurrentStationFavorite = computed(() => {
    const stationUuid = this.station()?.stationuuid;

    return stationUuid
      ? this.favoriteStations().some((favorite) => favorite.stationuuid === stationUuid)
      : false;
  });

  protected async handlePlaybackButton(): Promise<void> {
    if (!this.station()) {
      return;
    }

    if (this.isPlaying()) {
      this.pauseCurrentStation();
      return;
    }

    await this.resumeCurrentStation();
  }

  protected async playRandomStation(): Promise<void> {
    this.isLoading.set(true);
    this.isPlaying.set(false);
    this.isTuning.set(true);
    this.error.set('');

    try {
      const station = await this.radioBrowser.getRandomStation();

      this.station.set(station);
      this.updatePageTitle(station.name);
      await this.playCurrentStation(station);
    } catch {
      this.isTuning.set(false);
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

  protected async playFavoriteStation(station: RadioStation): Promise<void> {
    this.isLoading.set(true);
    this.isPlaying.set(false);
    this.isTuning.set(true);
    this.error.set('');
    this.station.set(station);
    this.updatePageTitle(station.name);
    this.isFavoritesMenuOpen.set(false);

    try {
      await this.playCurrentStation(station);
    } catch {
      this.isTuning.set(false);
      this.error.set('The station could not be played. Try another one.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private async playCurrentStation(station: RadioStation): Promise<void> {
    const audio = this.audio()?.nativeElement;

    if (!audio) {
      throw new Error('The audio player is not available.');
    }

    audio.src = this.radioBrowser.streamUrl(station);
    audio.autoplay = true;
    audio.volume = this.volume();
    audio.load();
    await audio.play();
    this.radioBrowser.reportStationClick(station.stationuuid).catch(() => undefined);
  }

  private pauseCurrentStation(): void {
    const audio = this.audio()?.nativeElement;

    if (!audio) {
      return;
    }

    audio.pause();
    this.isPlaying.set(false);
    this.isTuning.set(false);
  }

  private async resumeCurrentStation(): Promise<void> {
    const audio = this.audio()?.nativeElement;

    if (!audio) {
      this.error.set('The audio player is not available.');
      return;
    }

    try {
      this.error.set('');
      this.isTuning.set(true);
      audio.volume = this.volume();
      await audio.play();
      this.isPlaying.set(true);
      this.isTuning.set(false);
    } catch {
      this.isPlaying.set(false);
      this.isTuning.set(false);
      this.error.set('The station could not be played. Try another one.');
    }
  }

  protected handleVolumeChange(volume: number): void {
    const audio = this.audio()?.nativeElement;

    this.volume.set(volume);

    if (audio) {
      audio.volume = volume;
    }
  }

  protected handleAudioError(): void {
    if (!this.currentStreamUrl()) {
      return;
    }

    this.isPlaying.set(false);
    this.isTuning.set(false);
    this.error.set('This stream stopped responding. Try another station.');
  }

  protected handleAudioPlaying(): void {
    this.isPlaying.set(true);
    this.isTuning.set(false);
    this.error.set('');
  }

  protected handleAudioStopped(): void {
    this.isPlaying.set(false);
    this.isTuning.set(false);
  }

  private currentStreamUrl(): string {
    const station = this.station();

    return station ? this.radioBrowser.streamUrl(station) : '';
  }

  private updatePageTitle(stationName: string): void {
    const name = stationName.trim();

    this.title.setTitle(name ? `Random Radio - ${name}` : this.defaultPageTitle);
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
