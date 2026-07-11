import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RadioBrowser, RadioStation } from './radio-browser';

@Component({
  selector: 'app-root',
  imports: [NgTemplateOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly radioBrowser = inject(RadioBrowser);
  private readonly title = inject(Title);
  private readonly defaultPageTitle = this.title.getTitle();
  private readonly audio = viewChild<ElementRef<HTMLAudioElement>>('audioPlayer');
  private readonly regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

  protected readonly station = signal<RadioStation | null>(null);
  protected readonly stationHomepage = computed(() => {
    const homepage = this.station()?.homepage.trim();

    if (!homepage) {
      return '';
    }

    return /^https?:\/\//i.test(homepage) ? homepage : '';
  });
  protected readonly isLoading = signal(false);
  protected readonly isPlaying = signal(false);
  protected readonly isTuning = signal(false);
  protected readonly volume = signal(1);
  protected readonly volumePercent = computed(() => Math.round(this.volume() * 100));
  protected readonly error = signal('');

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

  protected handleVolumeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const nextVolume = Number(input.value);

    if (!Number.isFinite(nextVolume)) {
      return;
    }

    const volume = Math.min(1, Math.max(0, nextVolume));
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

  protected countryName(countryCode: string): string {
    try {
      return this.regionNames.of(countryCode.toUpperCase()) ?? countryCode;
    } catch {
      return countryCode;
    }
  }

  protected countryFlag(countryCode: string): string {
    const normalizedCode = countryCode.trim().toUpperCase();

    if (!/^[A-Z]{2}$/.test(normalizedCode)) {
      return '';
    }

    return String.fromCodePoint(
      ...[...normalizedCode].map((letter) => letter.codePointAt(0)! + 127397),
    );
  }

  private currentStreamUrl(): string {
    const station = this.station();

    return station ? this.radioBrowser.streamUrl(station) : '';
  }

  private updatePageTitle(stationName: string): void {
    const name = stationName.trim();

    this.title.setTitle(name ? `Random Radio - ${name}` : this.defaultPageTitle);
  }
}
