import {
  Component,
  ElementRef,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AudioControls } from '../audio-controls/audio-controls';

const volumeStorageKey = 'random-radio:volume';

export interface AudioSource {
  readonly url: string;
}

export type AudioPlayerError = 'player-unavailable' | 'playback-failed' | 'stream-failed';

export interface AudioPlayerState {
  isPlaying: boolean;
  isBuffering: boolean;
  error: AudioPlayerError | null;
}

@Component({
  selector: 'app-audio-player',
  imports: [AudioControls],
  templateUrl: './audio-player.html',
  styleUrl: './audio-player.css',
})
export class AudioPlayer {
  private readonly audio = viewChild<ElementRef<HTMLAudioElement>>('audioPlayer');

  readonly source = input.required<AudioSource>();
  readonly disabled = input(false);
  readonly playerStateChanged = output<AudioPlayerState>();
  readonly playbackStarted = output<AudioSource>();

  protected readonly isPlaying = signal(false);
  protected readonly volume = signal(this.readStoredVolume());

  constructor() {
    effect(() => {
      const audio = this.audio()?.nativeElement;
      const source = this.source();

      if (!audio) {
        return;
      }

      void this.playSource(audio, source);
    });
  }

  protected async handlePlaybackButton(): Promise<void> {
    if (this.isPlaying()) {
      this.pausePlayback();
      return;
    }

    await this.resumePlayback();
  }

  protected handleVolumeChange(volume: number): void {
    const audio = this.audio()?.nativeElement;

    this.volume.set(volume);
    this.storeVolume(volume);

    if (audio) {
      audio.volume = volume;
    }
  }

  protected handleAudioError(): void {
    if (!this.currentStreamUrl()) {
      return;
    }

    this.setPlayerState({
      isPlaying: false,
      isBuffering: false,
      error: 'stream-failed',
    });
  }

  protected handleAudioPlaying(): void {
    this.setPlayerState({ isPlaying: true, isBuffering: false, error: null });
  }

  protected handleAudioStopped(): void {
    this.setPlayerState({ isPlaying: false, isBuffering: false, error: null });
  }

  private async playSource(audio: HTMLAudioElement, source: AudioSource): Promise<void> {
    this.setPlayerState({ isPlaying: false, isBuffering: true, error: null });

    audio.src = source.url;
    audio.autoplay = true;
    audio.volume = untracked(() => this.volume());
    audio.load();

    try {
      await audio.play();

      if (!this.isCurrentSource(source)) {
        return;
      }

      this.playbackStarted.emit(source);
    } catch {
      if (!this.isCurrentSource(source)) {
        return;
      }

      this.setPlayerState({
        isPlaying: false,
        isBuffering: false,
        error: 'playback-failed',
      });
    }
  }

  private pausePlayback(): void {
    const audio = this.audio()?.nativeElement;

    if (!audio) {
      return;
    }

    audio.pause();
    this.setPlayerState({ isPlaying: false, isBuffering: false, error: null });
  }

  private async resumePlayback(): Promise<void> {
    const audio = this.audio()?.nativeElement;

    if (!audio) {
      this.setPlayerState({
        isPlaying: false,
        isBuffering: false,
        error: 'player-unavailable',
      });
      return;
    }

    try {
      this.setPlayerState({ isPlaying: false, isBuffering: true, error: null });
      audio.volume = this.volume();
      await audio.play();
      this.setPlayerState({ isPlaying: true, isBuffering: false, error: null });
    } catch {
      this.setPlayerState({
        isPlaying: false,
        isBuffering: false,
        error: 'playback-failed',
      });
    }
  }

  private currentStreamUrl(): string {
    const audio = this.audio()?.nativeElement;

    return audio?.currentSrc || audio?.src || '';
  }

  private readStoredVolume(): number {
    const storedValue = localStorage.getItem(volumeStorageKey);

    if (storedValue === null) {
      return 1;
    }

    const volume = Number(storedValue);

    return Number.isFinite(volume) && volume >= 0 && volume <= 1 ? volume : 1;
  }

  private storeVolume(volume: number): void {
    localStorage.setItem(volumeStorageKey, String(volume));
  }

  private isCurrentSource(source: AudioSource): boolean {
    return source === this.source();
  }

  private setPlayerState(state: AudioPlayerState): void {
    this.isPlaying.set(state.isPlaying);
    this.playerStateChanged.emit(state);
  }
}
