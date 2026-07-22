import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { RadioStation } from '../models/radio-station';
import { FavoritesStore } from './favorites-store';

function createStation(overrides: Partial<RadioStation> = {}): RadioStation {
  return {
    source: {
      provider: 'radio-browser',
      externalId: 'station-1',
    },
    name: 'Station One',
    streamUrl: 'https://stream.example.com/live',
    homepageUrl: 'https://example.com',
    imageUrl: '',
    countryCode: 'AR',
    ...overrides,
  };
}

describe('FavoritesStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load valid favorite stations from browser storage', () => {
    const station = createStation();
    localStorage.setItem(
      'random-radio:favorites',
      JSON.stringify({
        version: 1,
        stations: [station, { source: { provider: 'invalid' } }],
      }),
    );

    const store = TestBed.inject(FavoritesStore);

    expect(store.stations()).toEqual([station]);
    expect(store.isFavorite(station)).toBe(true);
  });

  it('should start empty when stored favorites are malformed', () => {
    localStorage.setItem('random-radio:favorites', '{not-json');

    const store = TestBed.inject(FavoritesStore);

    expect(store.stations()).toEqual([]);
  });

  it('should start empty when the stored favorites version is unsupported', () => {
    localStorage.setItem(
      'random-radio:favorites',
      JSON.stringify({ version: 2, stations: [createStation()] }),
    );

    const store = TestBed.inject(FavoritesStore);

    expect(store.stations()).toEqual([]);
  });

  it('should add, remove, and persist favorite stations', () => {
    const store = TestBed.inject(FavoritesStore);
    const station = createStation();

    store.toggle(station);

    expect(store.stations()).toEqual([station]);
    expect(store.isFavorite(station)).toBe(true);
    expect(JSON.parse(localStorage.getItem('random-radio:favorites') ?? 'null')).toEqual({
      version: 1,
      stations: [station],
    });

    store.toggle(station);

    expect(store.stations()).toEqual([]);
    expect(store.isFavorite(station)).toBe(false);
    expect(JSON.parse(localStorage.getItem('random-radio:favorites') ?? 'null')).toEqual({
      version: 1,
      stations: [],
    });
  });

  it('should expose an error when favorites cannot be persisted', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    const store = TestBed.inject(FavoritesStore);

    store.toggle(createStation());

    expect(store.persistenceError()).toBe('Favorites could not be saved in this browser.');
  });
});
