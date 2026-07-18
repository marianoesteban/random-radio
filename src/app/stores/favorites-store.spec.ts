import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { RadioStation } from '../services/radio-browser';
import { FavoritesStore } from './favorites-store';

function createStation(overrides: Partial<RadioStation> = {}): RadioStation {
  return {
    stationuuid: 'station-1',
    name: 'Station One',
    url: 'https://example.com/live',
    url_resolved: 'https://stream.example.com/live',
    homepage: 'https://example.com',
    favicon: '',
    countrycode: 'AR',
    language: 'Spanish',
    tags: 'music',
    codec: 'MP3',
    bitrate: 128,
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
      JSON.stringify([station, { stationuuid: 'invalid' }]),
    );

    const store = TestBed.inject(FavoritesStore);

    expect(store.stations()).toEqual([station]);
    expect(store.isFavorite(station.stationuuid)).toBe(true);
  });

  it('should start empty when stored favorites are malformed', () => {
    localStorage.setItem('random-radio:favorites', '{not-json');

    const store = TestBed.inject(FavoritesStore);

    expect(store.stations()).toEqual([]);
  });

  it('should add, remove, and persist favorite stations', () => {
    const store = TestBed.inject(FavoritesStore);
    const station = createStation();

    store.toggle(station);

    expect(store.stations()).toEqual([station]);
    expect(store.isFavorite(station.stationuuid)).toBe(true);
    expect(JSON.parse(localStorage.getItem('random-radio:favorites') ?? '[]')).toEqual([station]);

    store.toggle(station);

    expect(store.stations()).toEqual([]);
    expect(store.isFavorite(station.stationuuid)).toBe(false);
    expect(JSON.parse(localStorage.getItem('random-radio:favorites') ?? '[]')).toEqual([]);
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
