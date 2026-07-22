import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RadioStation } from '../models/radio-station';

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
  private readonly randomOffsetLimit = 100;

  async getRandomStation(): Promise<RadioStation> {
    const params = new HttpParams()
      .set('hidebroken', 'true')
      .set('limit', '1')
      .set('offset', this.randomOffset())
      .set('order', 'random');

    const stations = await firstValueFrom(
      this.http.get<RadioBrowserStation[]>(`${this.baseUrl}/stations/search`, { params }),
    );

    const station = stations.find((candidate) => candidate.url_resolved || candidate.url);

    if (!station) {
      throw new Error('No playable station was returned.');
    }

    return this.toRadioStation(station);
  }

  async reportStationClick(stationId: string): Promise<void> {
    await firstValueFrom(this.http.get<unknown>(`${this.baseUrl}/url/${stationId}`));
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
