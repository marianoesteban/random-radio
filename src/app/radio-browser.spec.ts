import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';

import { RadioBrowser, RadioStation } from './radio-browser';

const baseUrl = 'https://de1.api.radio-browser.info/json';

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function createStation(overrides: Partial<RadioStation> = {}): RadioStation {
  return {
    stationuuid: 'station-1',
    name: 'Station One',
    url: 'https://example.com/live',
    url_resolved: 'https://stream.example.com/live',
    homepage: 'https://example.com',
    favicon: 'https://example.com/favicon.ico',
    countrycode: 'AR',
    language: 'Spanish',
    tags: 'music',
    codec: 'MP3',
    bitrate: 128,
    ...overrides,
  };
}

describe('RadioBrowser', () => {
  let service: RadioBrowser;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RadioBrowser);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should request one playable random station with the expected filters', async () => {
    const station = createStation();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const stationPromise = service.getRandomStation();

    const statsRequest = http.expectOne(`${baseUrl}/stats`);
    expect(statsRequest.request.method).toBe('GET');
    statsRequest.flush({ stations: 10 });
    await flushPromises();

    const searchRequest = http.expectOne((request) => request.url === `${baseUrl}/stations/search`);
    expect(searchRequest.request.method).toBe('GET');
    expect(searchRequest.request.params.get('hidebroken')).toBe('true');
    expect(searchRequest.request.params.get('limit')).toBe('1');
    expect(searchRequest.request.params.get('offset')).toBe('5');
    expect(searchRequest.request.params.get('order')).toBe('random');
    searchRequest.flush([station]);

    await expect(stationPromise).resolves.toEqual(station);
  });

  it('should cache the station count between random station requests', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const firstStationPromise = service.getRandomStation();
    http.expectOne(`${baseUrl}/stats`).flush({ stations: 25 });
    await flushPromises();
    http.expectOne((request) => request.url === `${baseUrl}/stations/search`).flush([
      createStation({ stationuuid: 'station-1' }),
    ]);
    await firstStationPromise;

    const secondStationPromise = service.getRandomStation();
    await flushPromises();
    http.expectNone(`${baseUrl}/stats`);
    http.expectOne((request) => request.url === `${baseUrl}/stations/search`).flush([
      createStation({ stationuuid: 'station-2' }),
    ]);

    await expect(secondStationPromise).resolves.toMatchObject({ stationuuid: 'station-2' });
  });

  it('should reject when the API does not return a playable station', async () => {
    const stationPromise = service.getRandomStation();

    http.expectOne(`${baseUrl}/stats`).flush({ stations: 1 });
    await flushPromises();
    http.expectOne((request) => request.url === `${baseUrl}/stations/search`).flush([
      createStation({ url: '', url_resolved: '' }),
    ]);

    await expect(stationPromise).rejects.toThrow('No playable station was returned.');
  });

  it('should prefer the resolved stream URL and fall back to the original URL', () => {
    expect(service.streamUrl(createStation())).toBe('https://stream.example.com/live');
    expect(service.streamUrl(createStation({ url_resolved: '' }))).toBe('https://example.com/live');
  });

  it('should report station clicks to Radio Browser', async () => {
    const clickPromise = service.reportStationClick('station-1');

    const clickRequest = http.expectOne(`${baseUrl}/url/station-1`);
    expect(clickRequest.request.method).toBe('GET');
    clickRequest.flush({
      ok: true,
      message: 'ok',
      stationuuid: 'station-1',
      name: 'Station One',
      url: 'https://example.com/live',
    });

    await expect(clickPromise).resolves.toBeUndefined();
  });
});
