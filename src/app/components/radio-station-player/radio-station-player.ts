import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { RadioStation, RadioStationSource, radioStationId } from '../../models/radio-station';
import {
  AudioPlayer,
  AudioPlayerError,
  AudioPlayerState,
  AudioSource,
} from '../audio-player/audio-player';
import { PlayerStatus } from '../player-status/player-status';
import { StationCard } from '../station-card/station-card';

interface ActiveRadioStation {
  readonly station: RadioStation;
  readonly source: AudioSource;
  readonly autoplay: boolean;
}

const audioPlayerErrorMessages: Record<AudioPlayerError, string> = {
  'player-unavailable': 'The audio player is not available.',
  'playback-failed': 'The station could not be played. Try another one.',
  'stream-failed': 'This stream stopped responding. Try another station.',
};

@Component({
  selector: 'app-radio-station-player',
  imports: [AudioPlayer, PlayerStatus, StationCard],
  templateUrl: './radio-station-player.html',
  styleUrl: './radio-station-player.css',
})
export class RadioStationPlayer {
  readonly station = input.required<RadioStation | null>();
  readonly autoplay = input(true);
  readonly isFavorite = input.required<boolean>();
  readonly isLoading = input(false);
  readonly error = input('');
  readonly favoriteToggled = output<RadioStation>();
  readonly playbackStarted = output<RadioStationSource>();

  protected readonly activeStation = signal<ActiveRadioStation | null>(null);
  protected readonly playerState = signal<AudioPlayerState>({
    isPlaying: false,
    isBuffering: false,
    error: null,
  });
  protected readonly statusError = computed(() => {
    const playerError = this.playerState().error;

    return this.error() || (playerError ? audioPlayerErrorMessages[playerError] : '');
  });
  protected readonly isStatusPlaying = computed(() =>
    this.isLoading() ? false : this.playerState().isPlaying,
  );
  protected readonly isStatusTuning = computed(() =>
    this.isLoading() ? false : this.playerState().isBuffering,
  );

  constructor() {
    effect(() => {
      const requestedStation = this.station();
      const autoplay = this.autoplay();
      const activeStation = untracked(this.activeStation);
      const isCurrentStationPlaying = untracked(() => this.playerState().isPlaying);
      const isSameStation =
        requestedStation && activeStation
          ? radioStationId(requestedStation) === radioStationId(activeStation.station)
          : requestedStation === activeStation;

      if (isSameStation && isCurrentStationPlaying) {
        return;
      }

      this.activeStation.set(
        requestedStation
          ? {
              station: requestedStation,
              source: { url: requestedStation.streamUrl },
              autoplay,
            }
          : null,
      );
    });
  }

  protected handlePlayerStateChange(state: AudioPlayerState): void {
    this.playerState.set(state);
  }

  protected handlePlaybackStarted(source: RadioStationSource): void {
    this.playbackStarted.emit(source);
  }
}
