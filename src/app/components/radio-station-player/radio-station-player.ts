import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { RadioStation, RadioStationSource, radioStationId } from '../../models/radio-station';
import {
  AudioPlayer,
  AudioPlayerError,
  AudioPlayerState,
  AudioPlaybackFailure,
  AudioSource,
} from '../audio-player/audio-player';
import { PlayerStatus } from '../player-status/player-status';
import { StationCard } from '../station-card/station-card';

interface ActiveRadioStation {
  readonly station: RadioStation;
  readonly source: AudioSource;
  readonly autoplay: boolean;
}

export type PlaybackRecovery = 'select-another-station' | 'user-action-required' | 'none';

interface AudioPlayerErrorDetails {
  readonly message: string;
  readonly recovery: PlaybackRecovery;
}

const audioPlayerErrorDetails: Record<AudioPlayerError, AudioPlayerErrorDetails> = {
  'autoplay-blocked': {
    message: 'Press play to start this station.',
    recovery: 'user-action-required',
  },
  'player-unavailable': {
    message: 'The audio player is not available.',
    recovery: 'none',
  },
  'playback-failed': {
    message: 'The station could not be played. Try another one.',
    recovery: 'select-another-station',
  },
  'stream-failed': {
    message: 'This stream stopped responding. Try another station.',
    recovery: 'select-another-station',
  },
};

export interface RadioStationPlaybackFailure {
  readonly source: RadioStationSource;
  readonly recovery: PlaybackRecovery;
}

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
  readonly playbackFailed = output<RadioStationPlaybackFailure>();

  protected readonly activeStation = signal<ActiveRadioStation | null>(null);
  protected readonly playerState = signal<AudioPlayerState>({
    isPlaying: false,
    isBuffering: false,
    error: null,
  });
  protected readonly statusError = computed(() => {
    const playerError = this.playerState().error;

    return this.error() || (playerError ? audioPlayerErrorDetails[playerError].message : '');
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

  protected handlePlaybackFailed(failure: AudioPlaybackFailure): void {
    const activeStation = this.activeStation();

    if (!activeStation || activeStation.source !== failure.source) {
      return;
    }

    this.playbackFailed.emit({
      source: activeStation.station.source,
      recovery: audioPlayerErrorDetails[failure.error].recovery,
    });
  }
}
