import { TestBed } from '@angular/core/testing';
import { type Mock, vi } from 'vitest';
import { RadioStation } from '../radio/radio-station';
import { FavoritesStorage } from './favorites-storage';
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
  let storage: {
    load: Mock<() => RadioStation[]>;
    save: Mock<(stations: RadioStation[]) => boolean>;
    serialize: Mock<(stations: RadioStation[]) => string>;
    parse: Mock<(contents: string) => RadioStation[] | null>;
  };

  beforeEach(() => {
    storage = {
      load: vi.fn(() => []),
      save: vi.fn(() => true),
      serialize: vi.fn(() => 'serialized favorites'),
      parse: vi.fn(() => null),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: FavoritesStorage, useValue: storage }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should add, remove, and persist favorite stations', () => {
    const store = TestBed.inject(FavoritesStore);
    const station = createStation();

    store.toggle(station);

    expect(store.stations()).toEqual([station]);
    expect(store.isFavorite(station)).toBe(true);
    expect(storage.save).toHaveBeenLastCalledWith([station]);

    store.toggle(station);

    expect(store.stations()).toEqual([]);
    expect(store.isFavorite(station)).toBe(false);
    expect(storage.save).toHaveBeenLastCalledWith([]);
  });

  it('should report when favorites cannot be persisted', () => {
    storage.save.mockReturnValue(false);
    const store = TestBed.inject(FavoritesStore);

    const result = store.toggle(createStation());

    expect(result).toEqual({ success: false, reason: 'persistence' });
    expect(store.stations()).toEqual([]);
  });

  it('should allow a later toggle after persistence becomes available', () => {
    storage.save.mockReturnValueOnce(false).mockReturnValueOnce(true);
    const store = TestBed.inject(FavoritesStore);
    const station = createStation();

    expect(store.toggle(station)).toEqual({ success: false, reason: 'persistence' });

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
    expect(storage.save).toHaveBeenLastCalledWith([updatedStation]);
  });

  it('should not update a missing favorite or in-memory state when persistence fails', () => {
    const store = TestBed.inject(FavoritesStore);
    const station = createStation();

    expect(store.update(station)).toEqual({ success: false, reason: 'not-found' });

    store.toggle(station);
    storage.save.mockReturnValueOnce(false);

    expect(store.update(createStation({ name: 'Updated Station' }))).toEqual({
      success: false,
      reason: 'persistence',
    });
    expect(store.stations()).toEqual([station]);
  });

  it('should reject additions beyond the favorite limit and allow removals at the limit', () => {
    const favorites = createStations(maximumFavoriteStations);
    storage.load.mockReturnValue(favorites);
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

  it('should delegate favorites export serialization', () => {
    const store = TestBed.inject(FavoritesStore);
    const station = createStation();

    store.toggle(station);

    expect(store.exportFavorites()).toBe('serialized favorites');
    expect(storage.serialize).toHaveBeenCalledWith([station]);
  });

  it('should merge imported favorites and ignore duplicates', () => {
    const existingStation = createStation();
    const importedStation = createStation({
      source: { provider: 'radio-browser', externalId: 'station-2' },
      name: 'Station Two',
    });
    const store = TestBed.inject(FavoritesStore);
    store.toggle(existingStation);
    storage.parse.mockReturnValue([importedStation, existingStation, importedStation]);

    const result = store.importFavorites('imported favorites');

    expect(result).toEqual({ success: true, imported: 1, total: 2 });
    expect(store.stations()).toEqual([importedStation, existingStation]);
    expect(storage.save).toHaveBeenLastCalledWith([importedStation, existingStation]);
  });

  it('should report no changes when every imported favorite already exists', () => {
    const station = createStation();
    const store = TestBed.inject(FavoritesStore);
    store.toggle(station);
    storage.parse.mockReturnValue([station]);

    const result = store.importFavorites('imported favorites');

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
    storage.parse.mockReturnValue([existingStation, importedStations[0], ...importedStations]);

    const result = store.importFavorites('imported favorites');

    expect(result).toEqual({ success: false, reason: 'limit' });
    expect(store.stations()).toEqual([existingStation]);
  });

  it('should load no more than the favorite limit from existing storage', () => {
    const favorites = createStations(maximumFavoriteStations + 1);
    storage.load.mockReturnValue(favorites);

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
    storage.parse.mockReturnValue(null);

    expect(store.importFavorites(contents)).toEqual({ success: false, reason: 'invalid' });
    expect(store.stations()).toEqual([station]);
  });

  it('should not update favorites when an import cannot be persisted', () => {
    const store = TestBed.inject(FavoritesStore);
    const station = createStation();
    storage.parse.mockReturnValue([station]);
    storage.save.mockReturnValue(false);

    const result = store.importFavorites('imported favorites');

    expect(result).toEqual({ success: false, reason: 'persistence' });
    expect(store.stations()).toEqual([]);
  });
});
