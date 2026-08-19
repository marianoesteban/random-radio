import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { RadioStation } from './radio-station';
import { LastPlayedStationStorage } from './last-played-station-storage';

const storageKey = 'random-radio:last-station';

function createStation(): RadioStation {
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
  };
}

describe('LastPlayedStationStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return null when no station has been saved', () => {
    const storage = TestBed.inject(LastPlayedStationStorage);

    expect(storage.load()).toBeNull();
  });

  it('should save and load a station in the versioned storage format', () => {
    const storage = TestBed.inject(LastPlayedStationStorage);
    const station = createStation();

    storage.save(station);

    expect(JSON.parse(localStorage.getItem(storageKey) ?? 'null')).toEqual({
      version: 1,
      station,
    });
    expect(storage.load()).toEqual(station);
  });

  it.each([
    { caseName: 'malformed JSON', storedValue: '{not-json' },
    {
      caseName: 'an unsupported version',
      storedValue: JSON.stringify({ version: 2, station: createStation() }),
    },
    {
      caseName: 'an invalid station',
      storedValue: JSON.stringify({
        version: 1,
        station: { name: 'Incomplete station' },
      }),
    },
  ])('should return null for $caseName', ({ storedValue }) => {
    localStorage.setItem(storageKey, storedValue);
    const storage = TestBed.inject(LastPlayedStationStorage);

    expect(storage.load()).toBeNull();
  });

  it('should return null when browser storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    const storage = TestBed.inject(LastPlayedStationStorage);

    expect(storage.load()).toBeNull();
  });

  it('should not throw when browser storage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    const storage = TestBed.inject(LastPlayedStationStorage);

    expect(() => storage.save(createStation())).not.toThrow();
  });
});
