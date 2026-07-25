import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-audio-controls',
  templateUrl: './audio-controls.html',
  styleUrl: './audio-controls.css',
})
export class AudioControls {
  readonly disabled = input(false);
  readonly isPlaying = input.required<boolean>();
  readonly volume = input.required<number>();
  readonly playbackRequested = output<void>();
  readonly volumeChanged = output<number>();

  protected readonly volumePercent = computed(() => Math.round(this.volume() * 100));
  protected readonly volumeLevel = computed<'muted' | 'low' | 'high'>(() => {
    const volume = this.volume();

    if (volume <= 0) {
      return 'muted';
    }

    return volume <= 0.5 ? 'low' : 'high';
  });
  protected readonly volumeAriaValue = computed(() => {
    const volumePercent = this.volumePercent();

    return volumePercent === 0 ? 'Muted' : `${volumePercent}% volume`;
  });

  protected requestPlayback(): void {
    this.playbackRequested.emit();
  }

  protected updateVolume(event: Event): void {
    const inputElement = event.target;

    if (!(inputElement instanceof HTMLInputElement)) {
      return;
    }

    const nextVolume = Number(inputElement.value);

    if (!Number.isFinite(nextVolume)) {
      return;
    }

    this.volumeChanged.emit(Math.min(1, Math.max(0, nextVolume)));
  }
}
