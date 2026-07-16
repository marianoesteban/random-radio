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
import { AudioControls } from '../audio-controls/audio-controls';
import { RadioBrowser, RadioStation } from '../../services/radio-browser';

export interface AudioPlayerState {
  isPlaying: boolean;
  isTuning: boolean;
  error: string;
}

@Component({
  selector: 'app-audio-player',
  imports: [AudioControls],
  templateUrl: './audio-player.html',
  styleUrl: './audio-player.css',
})
export class AudioPlayer {
  private readonly radioBrowser = inject(RadioBrowser);
  private readonly audio = viewChild<ElementRef<HTMLAudioElement>>('audioPlayer');
  private activePlayRequestId = 0;

  readonly station = input.required<RadioStation>();
  readonly isLoading = input.required<boolean>();
  readonly playRequestId = input.required<number>();
  readonly playerStateChanged = output<AudioPlayerState>();

  protected readonly isPlaying = signal(false);
  protected readonly isTuning = signal(false);
  protected readonly volume = signal(1);
  protected readonly error = signal('');

  constructor() {
    effect(() => {
      const audio = this.audio()?.nativeElement;
      const station = this.station();
      const playRequestId = this.playRequestId();

      if (!audio) {
        return;
      }

      void this.playCurrentStation(audio, station, playRequestId);
    });
  }

  protected async handlePlaybackButton(): Promise<void> {
    if (this.isPlaying()) {
      this.pauseCurrentStation();
      return;
    }

    await this.resumeCurrentStation();
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

    this.setPlayerState({
      isPlaying: false,
      isTuning: false,
      error: 'This stream stopped responding. Try another station.',
    });
  }

  protected handleAudioPlaying(): void {
    this.setPlayerState({ isPlaying: true, isTuning: false, error: '' });
  }

  protected handleAudioStopped(): void {
    this.setPlayerState({ isPlaying: false, isTuning: false, error: '' });
  }

  private async playCurrentStation(
    audio: HTMLAudioElement,
    station: RadioStation,
    playRequestId: number,
  ): Promise<void> {
    this.activePlayRequestId = playRequestId;
    this.setPlayerState({ isPlaying: false, isTuning: true, error: '' });

    audio.src = this.radioBrowser.streamUrl(station);
    audio.autoplay = true;
    audio.volume = untracked(() => this.volume());
    audio.load();

    try {
      await audio.play();

      if (!this.isCurrentPlayRequest(playRequestId)) {
        return;
      }

      this.radioBrowser.reportStationClick(station.stationuuid).catch(() => undefined);
    } catch {
      if (!this.isCurrentPlayRequest(playRequestId)) {
        return;
      }

      this.setPlayerState({
        isPlaying: false,
        isTuning: false,
        error: 'The station could not be played. Try another one.',
      });
    }
  }

  private pauseCurrentStation(): void {
    const audio = this.audio()?.nativeElement;

    if (!audio) {
      return;
    }

    audio.pause();
    this.setPlayerState({ isPlaying: false, isTuning: false, error: '' });
  }

  private async resumeCurrentStation(): Promise<void> {
    const audio = this.audio()?.nativeElement;

    if (!audio) {
      this.setPlayerState({
        isPlaying: false,
        isTuning: false,
        error: 'The audio player is not available.',
      });
      return;
    }

    try {
      this.setPlayerState({ isPlaying: false, isTuning: true, error: '' });
      audio.volume = this.volume();
      await audio.play();
      this.setPlayerState({ isPlaying: true, isTuning: false, error: '' });
    } catch {
      this.setPlayerState({
        isPlaying: false,
        isTuning: false,
        error: 'The station could not be played. Try another one.',
      });
    }
  }

  private currentStreamUrl(): string {
    const audio = this.audio()?.nativeElement;

    return audio?.currentSrc || audio?.src || '';
  }

  private isCurrentPlayRequest(playRequestId: number): boolean {
    return playRequestId === this.activePlayRequestId;
  }

  private setPlayerState(state: AudioPlayerState): void {
    this.isPlaying.set(state.isPlaying);
    this.isTuning.set(state.isTuning);
    this.error.set(state.error);
    this.playerStateChanged.emit(state);
  }
}
