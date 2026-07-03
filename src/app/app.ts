import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RadioBrowser, RadioStation } from './radio-browser';

@Component({
  selector: 'app-root',
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
  protected readonly isLoading = signal(false);
  protected readonly error = signal('');

  protected async playRandomStation(): Promise<void> {
    this.isLoading.set(true);
    this.error.set('');

    try {
      const station = await this.radioBrowser.getRandomStation();

      this.station.set(station);
      this.updatePageTitle(station.name);
      await this.playCurrentStation(station);
    } catch {
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
    audio.load();
    await audio.play();
    this.radioBrowser.reportStationClick(station.stationuuid).catch(() => undefined);
  }

  protected handleAudioError(): void {
    if (!this.currentStreamUrl()) {
      return;
    }

    this.error.set('This stream stopped responding. Try another station.');
  }

  protected countryName(countryCode: string): string {
    try {
      return this.regionNames.of(countryCode.toUpperCase()) ?? countryCode;
    } catch {
      return countryCode;
    }
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
