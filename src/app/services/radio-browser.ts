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

export function radioStationStreamUrl(station: RadioStation): string {
  return station.url_resolved || station.url;
}

interface StationClickResponse {
  ok: string | boolean;
  message: string;
  stationuuid: string;
  name: string;
  url: string;
}

@Service()
export class RadioBrowser {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://de1.api.radio-browser.info/json';
  private readonly randomOffsetLimit = 100;

  async getRandomStation(): Promise<RadioStation> {
    const params = new HttpParams()
      .set('hidebroken', 'true')
      .set('limit', '1')
      .set('offset', this.randomOffset())
      .set('order', 'random');

    const stations = await firstValueFrom(
      this.http.get<RadioStation[]>(`${this.baseUrl}/stations/search`, { params }),
    );

    const station = stations.find((candidate) => radioStationStreamUrl(candidate));

    if (!station) {
      throw new Error('No playable station was returned.');
    }

    return station;
  }

  async reportStationClick(stationUuid: string): Promise<void> {
    await firstValueFrom(this.http.get<StationClickResponse>(`${this.baseUrl}/url/${stationUuid}`));
  }

  private randomOffset(): string {
    return Math.floor(Math.random() * this.randomOffsetLimit).toString();
  }
}
