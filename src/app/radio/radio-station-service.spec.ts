import { TestBed } from '@angular/core/testing';
import { type Mock, vi } from 'vitest';
import { RadioStation } from './radio-station';
import { RadioBrowser } from './radio-browser';
import { RadioStationService } from './radio-station-service';

function createStation(provider = RadioBrowser.provider): RadioStation {
  return {
    source: { provider, externalId: 'station-1' },
    name: 'Station One',
    streamUrl: 'https://stream.example.com/live',
    homepageUrl: 'https://example.com',
    imageUrl: '',
    countryCode: 'AR',
  };
}

describe('RadioStationService', () => {
  let service: RadioStationService;
  let radioBrowser: {
    getRandomStation: Mock<() => Promise<RadioStation>>;
    getStation: Mock<(stationId: string) => Promise<RadioStation>>;
    reportStationClick: Mock<(stationId: string) => Promise<void>>;
  };

  beforeEach(() => {
    radioBrowser = {
      getRandomStation: vi.fn(),
      getStation: vi.fn(),
      reportStationClick: vi.fn(() => Promise.resolve()),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: RadioBrowser, useValue: radioBrowser }],
    });
    service = TestBed.inject(RadioStationService);
  });

  it('should delegate random station selection to Radio Browser', async () => {
    const station = createStation();
    radioBrowser.getRandomStation.mockResolvedValue(station);

    await expect(service.getRandomStation()).resolves.toBe(station);
  });

  it('should refresh and report playback for Radio Browser stations', async () => {
    const storedStation = createStation();
    const currentStation = { ...storedStation, name: 'Current Station' };
    radioBrowser.getStation.mockResolvedValue(currentStation);

    expect(service.canRefresh(storedStation.source)).toBe(true);
    await expect(service.refreshStation(storedStation)).resolves.toBe(currentStation);
    await expect(service.reportPlayback(storedStation.source)).resolves.toBeUndefined();
    expect(radioBrowser.getStation).toHaveBeenCalledWith('station-1');
    expect(radioBrowser.reportStationClick).toHaveBeenCalledWith('station-1');
  });

  it('should preserve stored data and skip reporting for unsupported providers', async () => {
    const station = createStation('other-api');

    expect(service.canRefresh(station.source)).toBe(false);
    await expect(service.refreshStation(station)).resolves.toBe(station);
    await expect(service.reportPlayback(station.source)).resolves.toBeUndefined();
    expect(radioBrowser.getStation).not.toHaveBeenCalled();
    expect(radioBrowser.reportStationClick).not.toHaveBeenCalled();
  });
});
