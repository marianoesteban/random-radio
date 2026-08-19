import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { RadioStation } from '../radio/radio-station';
import { FavoritesStorage } from './favorites-storage';

const storageKey = 'random-radio:favorites';

function createStation(): RadioStation {
  return {
    source: { provider: 'radio-browser', externalId: 'station-1' },
    name: 'Station One',
    streamUrl: 'https://stream.example.com/live',
    homepageUrl: 'https://example.com',
    imageUrl: '',
    countryCode: 'AR',
  };
}

describe('FavoritesStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads valid favorites and discards invalid stored entries', () => {
    const station = createStation();
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 1,
        stations: [station, { source: { provider: 'invalid' } }],
      }),
    );

    expect(TestBed.inject(FavoritesStorage).load()).toEqual([station]);
  });

  it.each([
    '{not-json',
    JSON.stringify({ version: 2, stations: [createStation()] }),
    JSON.stringify({ version: 1, stations: 'not-an-array' }),
  ])('returns no favorites for invalid stored data', (contents) => {
    localStorage.setItem(storageKey, contents);

    expect(TestBed.inject(FavoritesStorage).load()).toEqual([]);
  });

  it('returns no favorites when browser storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    expect(TestBed.inject(FavoritesStorage).load()).toEqual([]);
  });

  it('saves favorites in the versioned format', () => {
    const station = createStation();
    const storage = TestBed.inject(FavoritesStorage);

    expect(storage.save([station])).toBe(true);
    expect(JSON.parse(localStorage.getItem(storageKey) ?? 'null')).toEqual({
      version: 1,
      stations: [station],
    });
  });

  it('reports when favorites cannot be saved', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    expect(TestBed.inject(FavoritesStorage).save([createStation()])).toBe(false);
  });

  it('serializes and parses a favorites transfer document', () => {
    const station = createStation();
    const storage = TestBed.inject(FavoritesStorage);

    expect(storage.parse(storage.serialize([station]))).toEqual([station]);
  });

  it.each([
    '{not-json',
    JSON.stringify({ version: 2, stations: [] }),
    JSON.stringify({ version: 1, stations: [{ name: 'Incomplete station' }] }),
  ])('rejects an invalid favorites transfer document', (contents) => {
    expect(TestBed.inject(FavoritesStorage).parse(contents)).toBeNull();
  });
});
