import { Service, inject } from '@angular/core';
import { RadioStation, RadioStationSource } from '../models/radio-station';
import { RadioBrowser } from './radio-browser';

@Service()
export class RadioStationService {
  private readonly radioBrowser = inject(RadioBrowser);

  getRandomStation(): Promise<RadioStation> {
    return this.radioBrowser.getRandomStation();
  }

  canRefresh(source: RadioStationSource): boolean {
    return source.provider === RadioBrowser.provider;
  }

  refreshStation(station: RadioStation): Promise<RadioStation> {
    return this.canRefresh(station.source)
      ? this.radioBrowser.getStation(station.source.externalId)
      : Promise.resolve(station);
  }

  reportPlayback(source: RadioStationSource): Promise<void> {
    return this.canRefresh(source)
      ? this.radioBrowser.reportStationClick(source.externalId)
      : Promise.resolve();
  }
}
