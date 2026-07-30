import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';

import { RadioBrowser } from './radio-browser';

const baseUrl = 'https://de1.api.radio-browser.info/json';

function createApiStation(overrides: Record<string, unknown> = {}) {
  return {
    stationuuid: 'station-1',
    name: 'Station One',
    url: 'https://example.com/live',
    url_resolved: 'https://stream.example.com/live',
    homepage: 'https://example.com',
    favicon: 'https://example.com/favicon.ico',
    countrycode: 'AR',
    unused_api_field: 'not part of the app model',
    ...overrides,
  };
}

function createApiStations(count: number, startAt = 1) {
  return Array.from({ length: count }, (_, index) => {
    const stationNumber = index + startAt;

    return createApiStation({
      stationuuid: `station-${stationNumber}`,
      name: `Station ${stationNumber}`,
      url_resolved: `https://stream.example.com/${stationNumber}`,
    });
  });
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
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

  it('should request a batch of playable random stations with the expected filters', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const stationPromise = service.getRandomStation();

    const searchRequest = http.expectOne((request) => request.url === `${baseUrl}/stations/search`);
    expect(searchRequest.request.method).toBe('GET');
    expect(searchRequest.request.params.get('hidebroken')).toBe('true');
    expect(searchRequest.request.params.get('limit')).toBe('5');
    expect(searchRequest.request.params.get('offset')).toBe('50');
    expect(searchRequest.request.params.get('order')).toBe('random');
    searchRequest.flush(createApiStations(5));

    await expect(stationPromise).resolves.toEqual({
      source: {
        provider: 'radio-browser',
        externalId: 'station-1',
      },
      name: 'Station 1',
      streamUrl: 'https://stream.example.com/1',
      homepageUrl: 'https://example.com',
      imageUrl: 'https://example.com/favicon.ico',
      countryCode: 'AR',
    });
  });

  it('should return queued stations without making another request', async () => {
    const firstStationPromise = service.getRandomStation();

    http
      .expectOne((request) => request.url === `${baseUrl}/stations/search`)
      .flush(createApiStations(5));

    await expect(firstStationPromise).resolves.toMatchObject({
      source: { externalId: 'station-1' },
    });
    await expect(service.getRandomStation()).resolves.toMatchObject({
      source: { externalId: 'station-2' },
    });
    http.expectNone((request) => request.url === `${baseUrl}/stations/search`);
  });

  it('should share a batch request between concurrent calls', async () => {
    const firstStationPromise = service.getRandomStation();
    const secondStationPromise = service.getRandomStation();

    http
      .expectOne((request) => request.url === `${baseUrl}/stations/search`)
      .flush(createApiStations(5));

    await expect(firstStationPromise).resolves.toMatchObject({
      source: { externalId: 'station-1' },
    });
    await expect(secondStationPromise).resolves.toMatchObject({
      source: { externalId: 'station-2' },
    });
  });

  it('should refill the queue in the background when two stations remain', async () => {
    const firstStationPromise = service.getRandomStation();
    http
      .expectOne((request) => request.url === `${baseUrl}/stations/search`)
      .flush(createApiStations(3));
    await firstStationPromise;

    const refillRequest = http.expectOne(
      (request) => request.url === `${baseUrl}/stations/search`,
    );
    refillRequest.flush(createApiStations(5, 4));

    await expect(service.getRandomStation()).resolves.toMatchObject({
      source: { externalId: 'station-2' },
    });
    await expect(service.getRandomStation()).resolves.toMatchObject({
      source: { externalId: 'station-3' },
    });
    await expect(service.getRandomStation()).resolves.toMatchObject({
      source: { externalId: 'station-4' },
    });
  });

  it('should retry a failed background refill without interrupting queued stations', async () => {
    const firstStationPromise = service.getRandomStation();
    http
      .expectOne((request) => request.url === `${baseUrl}/stations/search`)
      .flush(createApiStations(3));
    await firstStationPromise;

    http
      .expectOne((request) => request.url === `${baseUrl}/stations/search`)
      .flush('Unavailable', { status: 503, statusText: 'Service Unavailable' });
    await flushPromises();

    const secondStationPromise = service.getRandomStation();
    http
      .expectOne((request) => request.url === `${baseUrl}/stations/search`)
      .flush(createApiStations(5, 4));

    await expect(secondStationPromise).resolves.toMatchObject({
      source: { externalId: 'station-2' },
    });
  });

  it('should reject when the API does not return a playable station', async () => {
    const stationPromise = service.getRandomStation();

    http
      .expectOne((request) => request.url === `${baseUrl}/stations/search`)
      .flush([createApiStation({ url: '', url_resolved: '' })]);

    await expect(stationPromise).rejects.toThrow('No playable station was returned.');
  });

  it('should fall back to the original stream URL', async () => {
    const stationPromise = service.getRandomStation();

    http
      .expectOne((request) => request.url === `${baseUrl}/stations/search`)
      .flush([
        createApiStation({ url_resolved: '' }),
        ...createApiStations(4).map((station, index) => ({
          ...station,
          stationuuid: `fallback-station-${index + 2}`,
        })),
      ]);

    await expect(stationPromise).resolves.toMatchObject({
      streamUrl: 'https://example.com/live',
    });
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
