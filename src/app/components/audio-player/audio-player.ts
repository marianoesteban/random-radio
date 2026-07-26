import {
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AudioPreferencesStorage } from '../../storage/audio-preferences-storage';
import { AudioControls } from '../audio-controls/audio-controls';

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
  private readonly preferencesStorage = inject(AudioPreferencesStorage);
  private readonly initialPreferences = this.preferencesStorage.load();
  private pendingPlayback: Promise<void> | null = null;
  private lastCommittedVolume = 1;

  readonly source = input.required<AudioSource>();
  readonly autoplay = input(true);
  readonly disabled = input(false);
  readonly playerStateChanged = output<AudioPlayerState>();
  readonly playbackStarted = output<AudioSource>();

  protected readonly isPlaying = signal(false);
  protected readonly isMuted = signal(this.initialPreferences.muted);
  protected readonly volume = signal(this.initialPreferences.volume);

  constructor() {
    this.lastCommittedVolume = this.volume();

    effect(() => {
      const audio = this.audio()?.nativeElement;
      const source = this.source();
      const autoplay = this.autoplay();

      if (!audio) {
        return;
      }

      if (autoplay) {
        void this.playSource(audio, source);
      } else {
        this.prepareSource(audio);
      }
    });
  }

  protected async handlePlaybackButton(): Promise<void> {
    if (this.isPlaying()) {
      this.stopPlayback();
      return;
    }

    const audio = this.audio()?.nativeElement;

    if (!audio) {
      this.setPlayerState({
        isPlaying: false,
        isBuffering: false,
        error: 'player-unavailable',
      });
      return;
    }

    await this.playSource(audio, this.source());
  }

  protected handleVolumeChange(volume: number): void {
    const audio = this.audio()?.nativeElement;

    if (volume <= 0) {
      this.setMuted(true);
      return;
    }

    this.volume.set(volume);
    this.setMuted(false);

    if (audio) {
      audio.volume = volume;
    }
  }

  protected handleVolumeChangeCommitted(volume: number): void {
    const audio = this.audio()?.nativeElement;

    if (volume <= 0) {
      this.volume.set(this.lastCommittedVolume);

      if (audio) {
        audio.volume = this.lastCommittedVolume;
      }

      return;
    }

    this.lastCommittedVolume = volume;
    this.volume.set(volume);
    this.preferencesStorage.saveVolume(volume);
    this.setMuted(false);

    if (audio) {
      audio.volume = volume;
    }
  }

  protected handleVolumeToggle(): void {
    this.setMuted(!this.isMuted());
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
    audio.muted = untracked(() => this.isMuted());
    audio.load();

    let playback: Promise<void> | null = null;

    try {
      playback = audio.play();
      this.pendingPlayback = playback;
      await playback;

      if (!this.isCurrentPlayback(playback, source)) {
        return;
      }

      this.pendingPlayback = null;
      this.playbackStarted.emit(source);
    } catch {
      if (playback && !this.isCurrentPlayback(playback, source)) {
        return;
      }

      this.pendingPlayback = null;
      this.setPlayerState({
        isPlaying: false,
        isBuffering: false,
        error: 'playback-failed',
      });
    }
  }

  private prepareSource(audio: HTMLAudioElement): void {
    this.pendingPlayback = null;
    audio.autoplay = false;
    audio.volume = untracked(() => this.volume());
    audio.muted = untracked(() => this.isMuted());
    this.setPlayerState({ isPlaying: false, isBuffering: false, error: null });
  }

  private stopPlayback(): void {
    const audio = this.audio()?.nativeElement;

    if (!audio) {
      return;
    }

    this.pendingPlayback = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    this.setPlayerState({ isPlaying: false, isBuffering: false, error: null });
  }

  private currentStreamUrl(): string {
    const audio = this.audio()?.nativeElement;

    return audio?.currentSrc || audio?.src || '';
  }

  private setMuted(isMuted: boolean): void {
    const audio = this.audio()?.nativeElement;

    this.isMuted.set(isMuted);
    this.preferencesStorage.saveMuted(isMuted);

    if (audio) {
      audio.muted = isMuted;
    }
  }

  private isCurrentPlayback(playback: Promise<void>, source: AudioSource): boolean {
    return playback === this.pendingPlayback && source === this.source();
  }

  private setPlayerState(state: AudioPlayerState): void {
    this.isPlaying.set(state.isPlaying);
    this.playerStateChanged.emit(state);
  }
}
