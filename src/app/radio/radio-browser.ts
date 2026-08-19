import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RadioStation } from './radio-station';

interface RadioBrowserStation {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  countrycode: string;
}

@Service()
export class RadioBrowser {
  static readonly provider = 'radio-browser';

  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://de1.api.radio-browser.info/json';
  private readonly stationBatchSize = 5;
  private readonly refillThreshold = 2;
  private readonly randomOffsetLimit = 100;
  private readonly stationQueue: RadioStation[] = [];
  private refillPromise: Promise<void> | null = null;

  async getRandomStation(): Promise<RadioStation> {
    while (true) {
      const station = this.stationQueue.shift();

      if (station) {
        if (this.stationQueue.length <= this.refillThreshold) {
          void this.refillQueue().catch(() => undefined);
        }

        return station;
      }

      await this.refillQueue();
    }
  }

  async getStation(stationId: string): Promise<RadioStation> {
    const stations = await firstValueFrom(
      this.http.get<RadioBrowserStation[]>(
        `${this.baseUrl}/stations/byuuid/${encodeURIComponent(stationId)}`,
      ),
    );
    const station = stations.find((candidate) => candidate.url_resolved || candidate.url);

    if (!station) {
      throw new Error('The station was not found or is not playable.');
    }

    return this.toRadioStation(station);
  }

  async reportStationClick(stationId: string): Promise<void> {
    await firstValueFrom(this.http.get<unknown>(`${this.baseUrl}/url/${stationId}`));
  }

  private async refillQueue(): Promise<void> {
    const activeRefill = this.refillPromise ?? this.fetchStations();
    this.refillPromise = activeRefill;

    try {
      await activeRefill;
    } finally {
      if (this.refillPromise === activeRefill) {
        this.refillPromise = null;
      }
    }
  }

  private async fetchStations(): Promise<void> {
    const params = new HttpParams()
      .set('hidebroken', 'true')
      .set('limit', this.stationBatchSize)
      .set('offset', this.randomOffset())
      .set('order', 'random');

    const stations = await firstValueFrom(
      this.http.get<RadioBrowserStation[]>(`${this.baseUrl}/stations/search`, { params }),
    );

    const playableStations = stations.filter((station) => station.url_resolved || station.url);

    if (playableStations.length === 0) {
      throw new Error('No playable station was returned.');
    }

    this.stationQueue.push(...playableStations.map((station) => this.toRadioStation(station)));
  }

  private toRadioStation(station: RadioBrowserStation): RadioStation {
    return {
      source: {
        provider: RadioBrowser.provider,
        externalId: station.stationuuid,
      },
      name: station.name,
      streamUrl: station.url_resolved || station.url,
      homepageUrl: station.homepage,
      imageUrl: station.favicon,
      countryCode: station.countrycode,
    };
  }

  private randomOffset(): string {
    return Math.floor(Math.random() * this.randomOffsetLimit).toString();
  }
}
