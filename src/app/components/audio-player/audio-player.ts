import {
  Component,
  DestroyRef,
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

export type AudioPlayerError =
  | 'autoplay-blocked'
  | 'player-unavailable'
  | 'playback-failed'
  | 'stream-failed'
  | 'stream-timeout';

export interface AudioPlaybackFailure {
  readonly source: AudioSource;
  readonly error: AudioPlayerError;
}

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
  private static readonly tuningTimeoutMilliseconds = 15_000;

  private readonly audio = viewChild<ElementRef<HTMLAudioElement>>('audioPlayer');
  private readonly destroyRef = inject(DestroyRef);
  private readonly preferencesStorage = inject(AudioPreferencesStorage);
  private readonly initialPreferences = this.preferencesStorage.load();
  private pendingPlayback: Promise<void> | null = null;
  private tuningTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastCommittedVolume = 1;

  readonly source = input.required<AudioSource>();
  readonly autoplay = input(true);
  readonly disabled = input(false);
  readonly isTuning = input(false);
  readonly playerStateChanged = output<AudioPlayerState>();
  readonly playbackStarted = output<AudioSource>();
  readonly playbackFailed = output<AudioPlaybackFailure>();

  protected readonly isPlaying = signal(false);
  protected readonly isBuffering = signal(false);
  protected readonly isMuted = signal(this.initialPreferences.muted);
  protected readonly volume = signal(this.initialPreferences.volume);

  constructor() {
    this.lastCommittedVolume = this.volume();
    this.destroyRef.onDestroy(() => this.clearTuningTimeout());

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

    if (this.isBuffering()) {
      this.cancelTuning();
      return;
    }

    const audio = this.audio()?.nativeElement;

    if (!audio) {
      this.failPlayback(this.source(), 'player-unavailable');
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

    this.failPlayback(this.source(), 'stream-failed');
  }

  protected handleAudioPlaying(): void {
    this.clearTuningTimeout();
    this.setPlayerState({ isPlaying: true, isBuffering: false, error: null });
  }

  protected handleAudioStopped(): void {
    this.setPlayerState({ isPlaying: false, isBuffering: false, error: null });
  }

  private async playSource(audio: HTMLAudioElement, source: AudioSource): Promise<void> {
    this.clearTuningTimeout();
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
      this.startTuningTimeout(audio, source, playback);
      await playback;

      if (!this.isCurrentPlayback(playback, source)) {
        return;
      }

      this.pendingPlayback = null;
      this.clearTuningTimeout();
      this.playbackStarted.emit(source);
    } catch (cause: unknown) {
      if (playback && !this.isCurrentPlayback(playback, source)) {
        return;
      }

      this.pendingPlayback = null;
      const error = this.isAutoplayBlocked(cause) ? 'autoplay-blocked' : 'playback-failed';

      this.failPlayback(source, error);
    }
  }

  private prepareSource(audio: HTMLAudioElement): void {
    this.clearTuningTimeout();
    this.pendingPlayback = null;
    audio.autoplay = false;
    audio.volume = untracked(() => this.volume());
    audio.muted = untracked(() => this.isMuted());
    this.setPlayerState({ isPlaying: false, isBuffering: false, error: null });
  }

  private cancelTuning(): void {
    this.stopPlayback();
  }

  private stopPlayback(): void {
    const audio = this.audio()?.nativeElement;

    if (!audio) {
      return;
    }

    this.clearTuningTimeout();
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

  private isAutoplayBlocked(cause: unknown): boolean {
    return (
      typeof cause === 'object' &&
      cause !== null &&
      'name' in cause &&
      cause.name === 'NotAllowedError'
    );
  }

  private failPlayback(source: AudioSource, error: AudioPlayerError): void {
    this.clearTuningTimeout();
    this.setPlayerState({
      isPlaying: false,
      isBuffering: false,
      error,
    });
    this.playbackFailed.emit({ source, error });
  }

  private setPlayerState(state: AudioPlayerState): void {
    this.isPlaying.set(state.isPlaying);
    this.isBuffering.set(state.isBuffering);
    this.playerStateChanged.emit(state);
  }

  private startTuningTimeout(
    audio: HTMLAudioElement,
    source: AudioSource,
    playback: Promise<void>,
  ): void {
    this.tuningTimeout = setTimeout(() => {
      if (!this.isCurrentPlayback(playback, source) || !this.isBuffering()) {
        return;
      }

      this.pendingPlayback = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      this.failPlayback(source, 'stream-timeout');
    }, AudioPlayer.tuningTimeoutMilliseconds);
  }

  private clearTuningTimeout(): void {
    if (this.tuningTimeout === null) {
      return;
    }

    clearTimeout(this.tuningTimeout);
    this.tuningTimeout = null;
  }
}
