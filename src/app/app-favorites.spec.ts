import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AppTestSetup, createStation, flushPromises } from './testing/app-test-setup';
import { RadioStation } from './models/radio-station';
import { NotificationService } from './services/notification-service';
import { FavoritesStore, maximumFavoriteStations } from './stores/favorites-store';

let setup: AppTestSetup;

beforeEach(async () => {
  setup = await AppTestSetup.create();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('favorites and transfers', () => {
  it('should persist favorite toggles from the station card', async () => {
    const station = createStation();
    const fixture = setup.createFixture();
    await setup.playRandomStation(fixture, station);

    const favoriteButton = fixture.nativeElement.querySelector(
      '.favorite-toggle',
    ) as HTMLButtonElement;

    favoriteButton.click();
    fixture.detectChanges();

    let favorites = JSON.parse(localStorage.getItem('random-radio:favorites') ?? 'null') as {
      version: number;
      stations: RadioStation[];
    };

    expect(favorites).toEqual({ version: 1, stations: [station] });

    favoriteButton.click();
    fixture.detectChanges();

    favorites = JSON.parse(localStorage.getItem('random-radio:favorites') ?? 'null') as {
      version: number;
      stations: RadioStation[];
    };

    expect(favorites).toEqual({ version: 1, stations: [] });
  });

  it('should clear an existing notification after a successful favorite toggle', async () => {
    const fixture = setup.createFixture();
    await setup.playRandomStation(fixture);
    const notifications = TestBed.inject(NotificationService);

    notifications.show('Existing notification.');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.favorite-notification')).not.toBeNull();

    (fixture.nativeElement.querySelector('.favorite-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.favorite-notification')).toBeNull();
  });

  it('should show favorite persistence errors in a global notification', async () => {
    const fixture = setup.createFixture();
    await setup.playRandomStation(fixture);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    const favoriteButton = fixture.nativeElement.querySelector(
      '.favorite-toggle',
    ) as HTMLButtonElement;
    favoriteButton.click();
    fixture.detectChanges();

    const favoriteError = fixture.nativeElement.querySelector(
      '.favorite-notification',
    ) as HTMLElement;
    const playerStatus = fixture.nativeElement.querySelector('.status') as HTMLElement;

    expect(favoriteError.getAttribute('role')).toBe('alert');
    expect(favoriteError.textContent).toContain('Favorites could not be saved in this browser.');
    expect(playerStatus.textContent).not.toContain('Favorites could not be saved');
  });

  it('should explain the favorite limit in a global notification', async () => {
    const favorites = Array.from({ length: maximumFavoriteStations }, (_, index) =>
      createStation({
        source: { provider: 'radio-browser', externalId: `favorite-${index}` },
      }),
    );
    localStorage.setItem(
      'random-radio:favorites',
      JSON.stringify({ version: 1, stations: favorites }),
    );
    const fixture = setup.createFixture();
    await setup.playRandomStation(
      fixture,
      createStation({
        source: { provider: 'radio-browser', externalId: 'one-too-many' },
      }),
    );

    (fixture.nativeElement.querySelector('.favorite-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    const favoriteError = fixture.nativeElement.querySelector(
      '.favorite-notification',
    ) as HTMLElement;

    expect(favoriteError.getAttribute('role')).toBe('alert');
    expect(favoriteError.textContent).toContain(
      `You can save up to ${maximumFavoriteStations} favorite stations.`,
    );
    const storedFavorites = JSON.parse(
      localStorage.getItem('random-radio:favorites') ?? 'null',
    ) as { stations: RadioStation[] };

    expect(storedFavorites.stations).toHaveLength(maximumFavoriteStations);
  });

  it('should load a favorite station and play it when selected', async () => {
    const station = createStation({
      source: { provider: 'radio-browser', externalId: 'favorite-1' },
      name: 'Saved Station',
    });
    localStorage.setItem(
      'random-radio:favorites',
      JSON.stringify({ version: 1, stations: [station] }),
    );
    const fixture = setup.createFixture();

    const menuButton = fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement;
    menuButton.click();
    fixture.detectChanges();

    const favoriteButton = fixture.nativeElement.querySelector(
      '.favorite-station',
    ) as HTMLButtonElement;
    favoriteButton.click();
    fixture.detectChanges();

    await setup.settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;

    expect(setup.stationService.getRandomStation).not.toHaveBeenCalled();
    expect(audio.src).toBe('https://stream.example.com/live');
    expect(setup.playAudio).toHaveBeenCalledOnce();
    expect(setup.stationService.reportPlayback).toHaveBeenCalledWith(station.source);
    expect(fixture.nativeElement.querySelector('.favorites-panel')).toBeNull();
  });

  it('should show loading and play the refreshed favorite data', async () => {
    const savedStation = createStation({
      source: { provider: 'radio-browser', externalId: 'favorite-1' },
      name: 'Old Station Name',
      streamUrl: 'https://stream.example.com/old',
    });
    const currentStation = createStation({
      source: { provider: 'radio-browser', externalId: 'favorite-1' },
      name: 'Current Station Name',
      streamUrl: 'https://stream.example.com/current',
    });
    localStorage.setItem(
      'random-radio:favorites',
      JSON.stringify({ version: 1, stations: [savedStation] }),
    );
    setup.stationService.refreshStation.mockResolvedValue(currentStation);
    const fixture = setup.createFixture();

    (fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.favorite-station') as HTMLButtonElement).click();
    fixture.detectChanges();

    const tuningFavorite = fixture.nativeElement.querySelector(
      '.favorite-station',
    ) as HTMLButtonElement;
    const randomButton = fixture.nativeElement.querySelector(
      '.primary-action',
    ) as HTMLButtonElement;

    expect(tuningFavorite.disabled).toBe(true);
    expect(tuningFavorite.textContent).toContain('Tuning...');
    expect(tuningFavorite.getAttribute('aria-label')).toBe('Tuning to Old Station Name');
    expect(randomButton.disabled).toBe(true);
    expect(randomButton.textContent).toContain('Play a Random Station');

    await setup.settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;

    expect(audio.src).toBe('https://stream.example.com/current');
    expect(fixture.nativeElement.querySelector('.favorites-panel')).toBeNull();
  });

  it('should keep the favorites menu open when current station data cannot be loaded', async () => {
    const station = createStation({
      source: { provider: 'radio-browser', externalId: 'favorite-1' },
    });
    localStorage.setItem(
      'random-radio:favorites',
      JSON.stringify({ version: 1, stations: [station] }),
    );
    setup.stationService.refreshStation.mockRejectedValue(new Error('offline'));
    const fixture = setup.createFixture();

    (fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.favorite-station') as HTMLButtonElement).click();
    await setup.settlePlayback(fixture);

    expect(fixture.nativeElement.querySelector('.favorites-panel')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.status')?.textContent).toContain(
      'The favorite station could not be loaded. Try again.',
    );
    expect(setup.playAudio).not.toHaveBeenCalled();
  });

  it('should keep playing without showing a notification when refreshed data cannot be persisted', async () => {
    const station = createStation({
      source: { provider: 'radio-browser', externalId: 'favorite-1' },
    });
    localStorage.setItem(
      'random-radio:favorites',
      JSON.stringify({ version: 1, stations: [station] }),
    );
    setup.stationService.refreshStation.mockResolvedValue(
      createStation({ ...station, name: 'Updated' }),
    );
    const fixture = setup.createFixture();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });

    (fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.favorite-station') as HTMLButtonElement).click();
    await setup.settlePlayback(fixture);

    expect(fixture.nativeElement.querySelector('.favorite-notification')).toBeNull();
    expect(setup.playAudio).toHaveBeenCalledOnce();
  });

  it('should not report a persistence error when a favorite is removed while loading', async () => {
    const station = createStation({
      source: { provider: 'radio-browser', externalId: 'favorite-1' },
    });
    localStorage.setItem(
      'random-radio:favorites',
      JSON.stringify({ version: 1, stations: [station] }),
    );
    setup.stationService.refreshStation.mockResolvedValue(station);
    const fixture = setup.createFixture();
    const notifications = TestBed.inject(NotificationService);

    notifications.show('Existing notification.');
    (fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.favorite-station') as HTMLButtonElement).click();
    TestBed.inject(FavoritesStore).toggle(station);
    await setup.settlePlayback(fixture);

    expect(fixture.nativeElement.querySelector('.favorite-notification')).toBeNull();
    expect(setup.playAudio).toHaveBeenCalledOnce();
  });

  it('should import favorites from a valid export file', async () => {
    const station = createStation({
      source: { provider: 'radio-browser', externalId: 'imported-1' },
      name: 'Imported Station',
    });
    const fixture = setup.createFixture();
    const menuButton = fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement;

    menuButton.click();
    fixture.detectChanges();

    const fileInput = fixture.nativeElement.querySelector('.file-input') as HTMLInputElement;
    const file = {
      size: 100,
      text: vi.fn().mockResolvedValue(JSON.stringify({ version: 1, stations: [station] })),
    } as unknown as File;
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: { item: () => file },
    });

    fileInput.dispatchEvent(new Event('change'));
    await flushPromises();
    fixture.detectChanges();

    expect(JSON.parse(localStorage.getItem('random-radio:favorites') ?? 'null')).toEqual({
      version: 1,
      stations: [station],
    });
    expect(fixture.nativeElement.querySelector('.favorite-count')?.textContent).toContain('1');
    expect(fixture.nativeElement.querySelector('.transfer-message')?.textContent).toContain(
      '1 favorite imported.',
    );
  });

  it('should keep import errors visible until the favorites menu is closed', async () => {
    const fixture = setup.createFixture();
    const menuButton = fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement;
    menuButton.click();
    fixture.detectChanges();

    const fileInput = fixture.nativeElement.querySelector('.file-input') as HTMLInputElement;
    const file = {
      size: 100,
      text: vi.fn().mockResolvedValue('{not-json'),
    } as unknown as File;
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: { item: () => file },
    });

    fileInput.dispatchEvent(new Event('change'));
    await flushPromises();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.transfer-message')?.getAttribute('role')).toBe(
      'alert',
    );

    menuButton.click();
    fixture.detectChanges();
    menuButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.transfer-message')).toBeNull();
  });
});
