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
