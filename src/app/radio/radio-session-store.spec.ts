import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { type Mock, vi } from 'vitest';
import { FavoritesStore } from '../favorites/favorites-store';
import { LastPlayedStationStorage } from './last-played-station-storage';
import { RadioStation, RadioStationSource } from './radio-station';
import { RadioStationService } from './radio-station-service';
import { RadioSessionStore } from './radio-session-store';

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

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe('RadioSessionStore', () => {
  let stationService: {
    getRandomStation: Mock<() => Promise<RadioStation>>;
    canRefresh: Mock<(source: RadioStationSource) => boolean>;
    refreshStation: Mock<(station: RadioStation) => Promise<RadioStation>>;
    reportPlayback: Mock<(source: RadioStationSource) => Promise<void>>;
  };
  let favoritesStore: {
    isFavorite: Mock<(station: RadioStation) => boolean>;
    update: Mock<(station: RadioStation) => { success: true }>;
  };
  let lastPlayedStationStorage: {
    load: Mock<() => RadioStation | null>;
    save: Mock<(station: RadioStation) => void>;
  };

  beforeEach(() => {
    document.title = 'Random Radio - Discover Live Stations';
    stationService = {
      getRandomStation: vi.fn(),
      canRefresh: vi.fn((source) => source.provider === 'radio-browser'),
      refreshStation: vi.fn((station) => Promise.resolve(station)),
      reportPlayback: vi.fn(() => Promise.resolve()),
    };
    favoritesStore = {
      isFavorite: vi.fn(() => false),
      update: vi.fn(() => ({ success: true })),
    };
    lastPlayedStationStorage = {
      load: vi.fn(() => null),
      save: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        RadioSessionStore,
        { provide: RadioStationService, useValue: stationService },
        { provide: FavoritesStore, useValue: favoritesStore },
        { provide: LastPlayedStationStorage, useValue: lastPlayedStationStorage },
      ],
    });
  });

  it('starts without a station when none was stored', () => {
    const store = TestBed.inject(RadioSessionStore);

    expect(store.station()).toBeNull();
    expect(store.shouldAutoplayStation()).toBe(false);
    expect(store.isStationLoading()).toBe(false);
    expect(store.stationError()).toBe('');
  });

  it('loads a random station and updates the session state', async () => {
    const station = createStation();
    stationService.getRandomStation.mockResolvedValue(station);
    const store = TestBed.inject(RadioSessionStore);

    await store.playRandomStation();

    expect(store.station()).toEqual(station);
    expect(store.station()).not.toBe(station);
    expect(store.shouldAutoplayStation()).toBe(true);
    expect(store.isSelectionLoading()).toBe(false);
    expect(document.title).toBe('Random Radio - Station One');
  });

  it('keeps the default page title when the selected station name is blank', async () => {
    stationService.getRandomStation.mockResolvedValue(createStation({ name: '   ' }));
    const store = TestBed.inject(RadioSessionStore);

    await store.playRandomStation();

    expect(document.title).toBe('Random Radio - Discover Live Stations');
  });

  it('exposes loading state while selecting a random station', async () => {
    const stationRequest = deferred<RadioStation>();
    stationService.getRandomStation.mockReturnValue(stationRequest.promise);
    const store = TestBed.inject(RadioSessionStore);

    const selection = store.playRandomStation();

    expect(store.isSelectionLoading()).toBe(true);
    expect(store.isStationLoading()).toBe(true);
    expect(store.loadingFavoriteStationId()).toBeNull();

    stationRequest.resolve(createStation());
    await selection;

    expect(store.isSelectionLoading()).toBe(false);
  });

  it('reports an error when random station selection fails', async () => {
    stationService.getRandomStation.mockRejectedValue(new Error('Unavailable'));
    const store = TestBed.inject(RadioSessionStore);

    await store.playRandomStation();

    expect(store.station()).toBeNull();
    expect(store.stationError()).toBe('The station could not be played. Try another one.');
    expect(store.isStationLoading()).toBe(false);
  });

  it('refreshes and selects a favorite station', async () => {
    const favorite = createStation();
    const refreshed = createStation({
      name: 'Refreshed Station',
      streamUrl: 'https://stream.example.com/refreshed',
    });
    const stationRequest = deferred<RadioStation>();
    stationService.refreshStation.mockReturnValue(stationRequest.promise);
    const store = TestBed.inject(RadioSessionStore);

    const selection = store.playFavoriteStation(favorite);

    expect(store.loadingFavoriteStationId()).toBe('radio-browser:station-1');

    stationRequest.resolve(refreshed);

    await expect(selection).resolves.toBe(true);
    expect(store.station()).toEqual(refreshed);
    expect(favoritesStore.update).toHaveBeenCalledWith(refreshed);
    expect(store.loadingFavoriteStationId()).toBeNull();
  });

  it('selects an unsupported favorite without updating its persisted data', async () => {
    const favorite = createStation({
      source: { provider: 'other-api', externalId: 'station-1' },
    });
    stationService.canRefresh.mockReturnValue(false);
    const store = TestBed.inject(RadioSessionStore);

    await expect(store.playFavoriteStation(favorite)).resolves.toBe(true);

    expect(stationService.refreshStation).toHaveBeenCalledWith(favorite);
    expect(favoritesStore.update).not.toHaveBeenCalled();
    expect(store.station()).toEqual(favorite);
  });

  it('selects the persisted favorite when its refresh fails', async () => {
    const initialStation = createStation();
    const unavailableFavorite = createStation({
      source: { provider: 'radio-browser', externalId: 'station-2' },
      name: 'Saved Favorite',
      streamUrl: 'https://stream.example.com/saved',
    });
    stationService.getRandomStation.mockResolvedValue(initialStation);
    stationService.refreshStation.mockRejectedValue(new Error('Unavailable'));
    const store = TestBed.inject(RadioSessionStore);

    await store.playRandomStation();

    await expect(store.playFavoriteStation(unavailableFavorite)).resolves.toBe(true);
    expect(store.station()).toEqual(unavailableFavorite);
    expect(store.stationError()).toBe('');
    expect(favoritesStore.update).not.toHaveBeenCalled();
  });

  it('refreshes a restored station and updates its persisted favorite', async () => {
    const storedStation = createStation();
    const refreshedStation = createStation({ name: 'Current Station' });
    lastPlayedStationStorage.load.mockReturnValue(storedStation);
    stationService.refreshStation.mockResolvedValue(refreshedStation);
    favoritesStore.isFavorite.mockReturnValue(true);

    const store = TestBed.inject(RadioSessionStore);
    await Promise.resolve();

    expect(store.station()).toEqual(refreshedStation);
    expect(lastPlayedStationStorage.save).toHaveBeenCalledWith(refreshedStation);
    expect(favoritesStore.update).toHaveBeenCalledWith(refreshedStation);
    expect(document.title).toBe('Random Radio - Current Station');
  });

  it('keeps a restored station when it cannot be refreshed', async () => {
    const storedStation = createStation();
    lastPlayedStationStorage.load.mockReturnValue(storedStation);
    stationService.refreshStation.mockRejectedValue(new Error('Unavailable'));

    const store = TestBed.inject(RadioSessionStore);
    await Promise.resolve();

    expect(store.station()).toEqual(storedStation);
    expect(lastPlayedStationStorage.save).not.toHaveBeenCalled();
    expect(store.isStationLoading()).toBe(false);
  });

  it('persists matching playback and reports it to the station provider', async () => {
    const station = createStation();
    stationService.getRandomStation.mockResolvedValue(station);
    const store = TestBed.inject(RadioSessionStore);
    await store.playRandomStation();

    store.handlePlaybackStarted(station.source);

    expect(lastPlayedStationStorage.save).toHaveBeenCalledWith(station);
    expect(stationService.reportPlayback).toHaveBeenCalledWith(station.source);
  });

  it('does not persist playback reported for a stale station', async () => {
    stationService.getRandomStation.mockResolvedValue(createStation());
    const store = TestBed.inject(RadioSessionStore);
    await store.playRandomStation();
    const staleSource = { provider: 'radio-browser', externalId: 'stale-station' };

    store.handlePlaybackStarted(staleSource);

    expect(lastPlayedStationStorage.save).not.toHaveBeenCalled();
    expect(stationService.reportPlayback).toHaveBeenCalledWith(staleSource);
  });

  it('automatically tries up to three random stations after playback failures', async () => {
    const stations = [
      createStation(),
      createStation({ source: { provider: 'radio-browser', externalId: 'station-2' } }),
      createStation({ source: { provider: 'radio-browser', externalId: 'station-3' } }),
    ];
    stationService.getRandomStation
      .mockResolvedValueOnce(stations[0])
      .mockResolvedValueOnce(stations[1])
      .mockResolvedValueOnce(stations[2]);
    const store = TestBed.inject(RadioSessionStore);
    await store.playRandomStation();

    store.handlePlaybackFailed({
      source: stations[0].source,
      recovery: 'select-another-station',
    });
    await Promise.resolve();
    store.handlePlaybackFailed({
      source: stations[1].source,
      recovery: 'select-another-station',
    });
    await Promise.resolve();
    store.handlePlaybackFailed({
      source: stations[2].source,
      recovery: 'select-another-station',
    });

    expect(stationService.getRandomStation).toHaveBeenCalledTimes(3);
    expect(store.station()).toEqual(stations[2]);
    expect(store.stationError()).toBe('Could not find a playable station. Try again.');
  });

  it('does not replace a random station that disconnected after playing', async () => {
    const station = createStation();
    stationService.getRandomStation.mockResolvedValue(station);
    const store = TestBed.inject(RadioSessionStore);
    await store.playRandomStation();
    store.handlePlaybackStarted(station.source);

    store.handlePlaybackFailed({
      source: station.source,
      recovery: 'select-another-station',
    });

    expect(stationService.getRandomStation).toHaveBeenCalledTimes(1);
    expect(store.stationError()).toBe(
      'Could not reconnect to this station. Press play to try again.',
    );
  });

  it('does not replace a favorite station after playback fails', async () => {
    const favorite = createStation();
    const store = TestBed.inject(RadioSessionStore);
    await store.playFavoriteStation(favorite);

    store.handlePlaybackFailed({
      source: favorite.source,
      recovery: 'select-another-station',
    });

    expect(stationService.getRandomStation).not.toHaveBeenCalled();
    expect(store.station()).toEqual(favorite);
  });
});
