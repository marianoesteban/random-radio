import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface RadioStation {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  countrycode: string;
  language: string;
  tags: string;
  codec: string;
  bitrate: number;
}

interface StationClickResponse {
  ok: string | boolean;
  message: string;
  stationuuid: string;
  name: string;
  url: string;
}

interface RadioBrowserStats {
  stations: number;
}

@Service()
export class RadioBrowser {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://de1.api.radio-browser.info/json';
  private stationCount: number | null = null;

  async getRandomStation(): Promise<RadioStation> {
    const stationCount = await this.getStationCount();
    const params = new HttpParams()
      .set('hidebroken', 'true')
      .set('limit', '1')
      .set('offset', this.randomOffset(stationCount))
      .set('order', 'random');

    const stations = await firstValueFrom(
      this.http.get<RadioStation[]>(`${this.baseUrl}/stations/search`, { params }),
    );

    const station = stations.find((candidate) => this.streamUrl(candidate));

    if (!station) {
      throw new Error('No playable station was returned.');
    }

    return station;
  }

  streamUrl(station: RadioStation): string {
    return station.url_resolved || station.url;
  }

  async reportStationClick(stationUuid: string): Promise<void> {
    await firstValueFrom(
      this.http.get<StationClickResponse>(`${this.baseUrl}/url/${stationUuid}`),
    );
  }

  private async getStationCount(): Promise<number> {
    if (this.stationCount) {
      return this.stationCount;
    }

    const stats = await firstValueFrom(
      this.http.get<RadioBrowserStats>(`${this.baseUrl}/stats`),
    );

    this.stationCount = Math.max(1, stats.stations);

    return this.stationCount;
  }

  private randomOffset(stationCount: number): string {
    return Math.floor(Math.random() * stationCount).toString();
  }
}
