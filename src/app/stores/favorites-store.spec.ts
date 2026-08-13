import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { RadioStation } from '../models/radio-station';
import { FavoritesStore, maximumFavoriteStations } from './favorites-store';

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

function createStations(count: number): RadioStation[] {
  return Array.from({ length: count }, (_, index) =>
    createStation({
      source: { provider: 'radio-browser', externalId: `station-${index}` },
      name: `Station ${index}`,
    }),
  );
}

describe('FavoritesStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load valid favorites and discard invalid stored entries', () => {
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

  it('should start empty when browser storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

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

  it('should report when favorites cannot be persisted', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    const store = TestBed.inject(FavoritesStore);

    const result = store.toggle(createStation());

    expect(result).toEqual({ success: false, reason: 'persistence' });
    expect(store.stations()).toEqual([]);
  });

  it('should allow a later toggle after persistence becomes available', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    const store = TestBed.inject(FavoritesStore);
    const station = createStation();

    expect(store.toggle(station)).toEqual({ success: false, reason: 'persistence' });

    setItem.mockRestore();

    expect(store.toggle(station)).toEqual({ success: true, action: 'added' });
    expect(store.stations()).toEqual([station]);
  });

  it('should update and persist the current data for an existing favorite', () => {
    const store = TestBed.inject(FavoritesStore);
    const station = createStation();
    const updatedStation = createStation({
      name: 'Updated Station',
      streamUrl: 'https://stream.example.com/updated',
    });
    store.toggle(station);

    expect(store.update(updatedStation)).toEqual({ success: true });
    expect(store.stations()).toEqual([updatedStation]);
    expect(JSON.parse(localStorage.getItem('random-radio:favorites') ?? 'null')).toEqual({
      version: 1,
      stations: [updatedStation],
    });
  });

  it('should not update a missing favorite or in-memory state when persistence fails', () => {
    const store = TestBed.inject(FavoritesStore);
    const station = createStation();

    expect(store.update(station)).toEqual({ success: false, reason: 'not-found' });

    store.toggle(station);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    expect(store.update(createStation({ name: 'Updated Station' }))).toEqual({
      success: false,
      reason: 'persistence',
    });
    expect(store.stations()).toEqual([station]);
  });

  it('should reject additions beyond the favorite limit and allow removals at the limit', () => {
    const favorites = createStations(maximumFavoriteStations);
    localStorage.setItem(
      'random-radio:favorites',
      JSON.stringify({ version: 1, stations: favorites }),
    );
    const store = TestBed.inject(FavoritesStore);

    const limitResult = store.toggle(
      createStation({
        source: { provider: 'radio-browser', externalId: 'one-too-many' },
      }),
    );

    expect(store.stations()).toHaveLength(maximumFavoriteStations);
    expect(limitResult).toEqual({ success: false, reason: 'limit' });

    const removalResult = store.toggle(favorites[0]);

    expect(removalResult).toEqual({ success: true, action: 'removed' });
    expect(store.stations()).toHaveLength(maximumFavoriteStations - 1);
    expect(store.isFavorite(favorites[0])).toBe(false);
  });

  it('should export favorites in the versioned storage format', () => {
    const store = TestBed.inject(FavoritesStore);
    const station = createStation();

    store.toggle(station);

    expect(JSON.parse(store.exportFavorites())).toEqual({
      version: 1,
      stations: [station],
    });
  });

  it('should merge imported favorites and ignore duplicates', () => {
    const existingStation = createStation();
    const importedStation = createStation({
      source: { provider: 'radio-browser', externalId: 'station-2' },
      name: 'Station Two',
    });
    const store = TestBed.inject(FavoritesStore);
    store.toggle(existingStation);

    const result = store.importFavorites(
      JSON.stringify({
        version: 1,
        stations: [importedStation, existingStation, importedStation],
      }),
    );

    expect(result).toEqual({ success: true, imported: 1, total: 2 });
    expect(store.stations()).toEqual([importedStation, existingStation]);
    expect(JSON.parse(localStorage.getItem('random-radio:favorites') ?? 'null')).toEqual({
      version: 1,
      stations: [importedStation, existingStation],
    });
  });

  it('should report no changes when every imported favorite already exists', () => {
    const station = createStation();
    const store = TestBed.inject(FavoritesStore);
    store.toggle(station);

    const result = store.importFavorites(
      JSON.stringify({
        version: 1,
        stations: [station],
      }),
    );

    expect(result).toEqual({ success: true, imported: 0, total: 1 });
    expect(store.stations()).toEqual([station]);
  });

  it('should reject imports that would exceed the favorite limit after deduplication', () => {
    const existingStation = createStation({
      source: { provider: 'radio-browser', externalId: 'existing' },
    });
    const importedStations = createStations(maximumFavoriteStations);
    const store = TestBed.inject(FavoritesStore);
    store.toggle(existingStation);

    const result = store.importFavorites(
      JSON.stringify({
        version: 1,
        stations: [existingStation, importedStations[0], ...importedStations],
      }),
    );

    expect(result).toEqual({ success: false, reason: 'limit' });
    expect(store.stations()).toEqual([existingStation]);
  });

  it('should load no more than the favorite limit from existing storage', () => {
    const favorites = createStations(maximumFavoriteStations + 1);
    localStorage.setItem(
      'random-radio:favorites',
      JSON.stringify({ version: 1, stations: favorites }),
    );

    const store = TestBed.inject(FavoritesStore);

    expect(store.stations()).toEqual(favorites.slice(0, maximumFavoriteStations));
  });

  it.each([
    '{not-json',
    JSON.stringify({ version: 2, stations: [] }),
    JSON.stringify({ version: 1, stations: [{ name: 'Incomplete station' }] }),
  ])('should reject an invalid favorites import without changing saved favorites', (contents) => {
    const station = createStation();
    const store = TestBed.inject(FavoritesStore);
    store.toggle(station);

    expect(store.importFavorites(contents)).toEqual({ success: false, reason: 'invalid' });
    expect(store.stations()).toEqual([station]);
  });

  it('should not update favorites when an import cannot be persisted', () => {
    const store = TestBed.inject(FavoritesStore);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    const result = store.importFavorites(
      JSON.stringify({ version: 1, stations: [createStation()] }),
    );

    expect(result).toEqual({ success: false, reason: 'persistence' });
    expect(store.stations()).toEqual([]);
  });
});
