import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-audio-controls',
  templateUrl: './audio-controls.html',
  styleUrl: './audio-controls.css',
})
export class AudioControls {
  readonly disabled = input(false);
  readonly isPlaying = input.required<boolean>();
  readonly isMuted = input.required<boolean>();
  readonly volume = input.required<number>();
  readonly playbackRequested = output<void>();
  readonly volumeToggleRequested = output<void>();
  readonly volumeChanged = output<number>();
  readonly volumeChangeCommitted = output<number>();

  protected readonly displayedVolume = computed(() => (this.isMuted() ? 0 : this.volume()));
  protected readonly volumePercent = computed(() => Math.round(this.displayedVolume() * 100));
  protected readonly volumeLevel = computed<'muted' | 'low' | 'high'>(() => {
    const volume = this.displayedVolume();

    if (volume <= 0) {
      return 'muted';
    }

    return volume <= 0.5 ? 'low' : 'high';
  });
  protected readonly volumeAriaValue = computed(() => {
    return this.isMuted() ? 'Muted' : `${this.volumePercent()}% volume`;
  });
  protected readonly volumeButtonLabel = computed(() => {
    return this.isMuted() ? 'Unmute audio' : 'Mute audio';
  });

  protected requestPlayback(): void {
    this.playbackRequested.emit();
  }

  protected requestVolumeToggle(): void {
    this.volumeToggleRequested.emit();
  }

  protected updateVolume(event: Event): void {
    const nextVolume = this.readVolume(event);

    if (nextVolume !== null) {
      this.volumeChanged.emit(nextVolume);
    }
  }

  protected commitVolume(event: Event): void {
    const nextVolume = this.readVolume(event);

    if (nextVolume !== null) {
      this.volumeChangeCommitted.emit(nextVolume);
    }
  }

  private readVolume(event: Event): number | null {
    const inputElement = event.target;

    if (!(inputElement instanceof HTMLInputElement)) {
      return null;
    }

    const nextVolume = Number(inputElement.value);

    if (!Number.isFinite(nextVolume)) {
      return null;
    }

    return Math.min(1, Math.max(0, nextVolume));
  }
}
