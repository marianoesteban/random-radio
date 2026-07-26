import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AudioPreferencesStorage } from './audio-preferences-storage';

describe('AudioPreferencesStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return the default preferences when none have been saved', () => {
    const storage = TestBed.inject(AudioPreferencesStorage);

    expect(storage.load()).toEqual({ volume: 1, muted: false });
  });

  it('should save and load volume and mute preferences independently', () => {
    const storage = TestBed.inject(AudioPreferencesStorage);

    storage.saveVolume(0.65);
    storage.saveMuted(true);

    expect(localStorage.getItem('random-radio:volume')).toBe('0.65');
    expect(localStorage.getItem('random-radio:muted')).toBe('true');
    expect(storage.load()).toEqual({ volume: 0.65, muted: true });
  });

  it.each(['', 'not-a-number', '0', '-0.1', '1.1'])(
    'should use the default volume for invalid stored value %s',
    (storedVolume) => {
      localStorage.setItem('random-radio:volume', storedVolume);
      const storage = TestBed.inject(AudioPreferencesStorage);

      expect(storage.load().volume).toBe(1);
    },
  );

  it('should only restore an explicitly saved muted state', () => {
    localStorage.setItem('random-radio:muted', 'invalid');
    const storage = TestBed.inject(AudioPreferencesStorage);

    expect(storage.load().muted).toBe(false);
  });

  it('should return defaults when browser storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    const storage = TestBed.inject(AudioPreferencesStorage);

    expect(storage.load()).toEqual({ volume: 1, muted: false });
  });

  it('should not throw when browser storage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    const storage = TestBed.inject(AudioPreferencesStorage);

    expect(() => storage.saveVolume(0.4)).not.toThrow();
    expect(() => storage.saveMuted(true)).not.toThrow();
  });
});
