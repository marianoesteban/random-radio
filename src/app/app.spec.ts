import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { type Mock, type MockInstance, vi } from 'vitest';
import { App } from './app';
import { RadioStation } from './models/radio-station';
import { RadioBrowser } from './services/radio-browser';

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

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('App', () => {
  let radioBrowser: {
    getRandomStation: Mock<() => Promise<RadioStation>>;
    reportStationClick: Mock<(stationId: string) => Promise<void>>;
  };
  let title: Title;
  let loadAudio: MockInstance<() => void>;
  let playAudio: MockInstance<() => Promise<void>>;
  let pauseAudio: MockInstance<() => void>;

  beforeEach(async () => {
    document.title = 'Random Radio - Discover Live Stations';
    localStorage.clear();
    radioBrowser = {
      getRandomStation: vi.fn(),
      reportStationClick: vi.fn(() => Promise.resolve()),
    };
    loadAudio = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    playAudio = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    pauseAudio = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: RadioBrowser, useValue: radioBrowser }],
    }).compileComponents();

    title = TestBed.inject(Title);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createFixture(): ComponentFixture<App> {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    return fixture;
  }

  async function settlePlayback(fixture: ComponentFixture<App>): Promise<void> {
    await fixture.whenStable();
    await flushPromises();
    fixture.detectChanges();
  }

  async function playRandomStation(
    fixture: ComponentFixture<App>,
    station = createStation(),
  ): Promise<HTMLAudioElement> {
    radioBrowser.getRandomStation.mockResolvedValue(station);

    const button = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    button.click();

    await settlePlayback(fixture);
    await settlePlayback(fixture);

    return fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
  }

  it('should create the app and render the shell heading', () => {
    const fixture = createFixture();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance).toBeTruthy();
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Press play and land somewhere on the dial.',
    );
  });

  it('should fetch a random station and wire it into audio playback', async () => {
    const station = createStation();
    radioBrowser.getRandomStation.mockResolvedValue(station);
    const fixture = createFixture();

    const button = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Loading...');

    await settlePlayback(fixture);
    await settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;

    expect(radioBrowser.getRandomStation).toHaveBeenCalledOnce();
    expect(audio.src).toBe('https://stream.example.com/live');
    expect(audio.hasAttribute('controls')).toBe(false);
    expect(loadAudio).toHaveBeenCalledOnce();
    expect(playAudio).toHaveBeenCalledOnce();
    expect(radioBrowser.reportStationClick).toHaveBeenCalledWith('station-1');
    expect(title.getTitle()).toBe('Random Radio - Station One');
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain('Play a Random Station');
    expect(fixture.nativeElement.querySelector('app-radio-station-player')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-station-card')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-audio-controls')).not.toBeNull();
  });

  it('should not report playback to Radio Browser for a station from another provider', async () => {
    const fixture = createFixture();

    await playRandomStation(
      fixture,
      createStation({
        source: { provider: 'other-api', externalId: 'station-1' },
      }),
    );

    expect(radioBrowser.reportStationClick).not.toHaveBeenCalled();
  });

  it('should stop and reconnect to the current station without selecting a new one', async () => {
    const fixture = createFixture();
    const audio = await playRandomStation(fixture);

    audio.dispatchEvent(new Event('playing'));
    fixture.detectChanges();

    const playbackButton = fixture.nativeElement.querySelector(
      '.playback-action',
    ) as HTMLButtonElement;

    playbackButton.click();
    fixture.detectChanges();

    expect(pauseAudio).toHaveBeenCalledOnce();
    expect(audio.src).toBe('');

    playbackButton.click();

    await fixture.whenStable();
    await flushPromises();

    expect(audio.src).toBe('https://stream.example.com/live');
    expect(playAudio).toHaveBeenCalledTimes(2);
    expect(radioBrowser.getRandomStation).toHaveBeenCalledOnce();
  });

  it('should update the audio volume from the audio controls', async () => {
    const fixture = createFixture();
    const audio = await playRandomStation(fixture);
    const volumeInput = fixture.nativeElement.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;

    volumeInput.value = '0.35';
    volumeInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(audio.volume).toBe(0.35);
  });

  it('should persist favorite toggles from the station card', async () => {
    const station = createStation();
    const fixture = createFixture();
    await playRandomStation(fixture, station);

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

  it('should load a favorite station and play it when selected', async () => {
    const station = createStation({
      source: { provider: 'radio-browser', externalId: 'favorite-1' },
      name: 'Saved Station',
    });
    localStorage.setItem(
      'random-radio:favorites',
      JSON.stringify({ version: 1, stations: [station] }),
    );
    const fixture = createFixture();

    const menuButton = fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement;
    menuButton.click();
    fixture.detectChanges();

    const favoriteButton = fixture.nativeElement.querySelector(
      '.favorite-station',
    ) as HTMLButtonElement;
    favoriteButton.click();
    fixture.detectChanges();

    await settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;

    expect(radioBrowser.getRandomStation).not.toHaveBeenCalled();
    expect(audio.src).toBe('https://stream.example.com/live');
    expect(loadAudio).toHaveBeenCalledOnce();
    expect(playAudio).toHaveBeenCalledOnce();
    expect(radioBrowser.reportStationClick).toHaveBeenCalledWith('favorite-1');
    expect(title.getTitle()).toBe('Random Radio - Saved Station');
    expect(fixture.nativeElement.querySelector('.favorites-panel')).toBeNull();
  });

  it('should import favorites from a valid export file', async () => {
    const station = createStation({
      source: { provider: 'radio-browser', externalId: 'imported-1' },
      name: 'Imported Station',
    });
    const fixture = createFixture();
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
    const fixture = createFixture();
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

  it('should keep playing a favorite when the same station is selected again', async () => {
    const station = createStation({
      source: { provider: 'radio-browser', externalId: 'favorite-1' },
    });
    localStorage.setItem(
      'random-radio:favorites',
      JSON.stringify({ version: 1, stations: [station] }),
    );
    const fixture = createFixture();
    const menuButton = fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement;

    menuButton.click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.favorite-station') as HTMLButtonElement).click();
    await settlePlayback(fixture);

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    audio.dispatchEvent(new Event('playing'));
    fixture.detectChanges();

    menuButton.click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.favorite-station') as HTMLButtonElement).click();
    fixture.detectChanges();
    await settlePlayback(fixture);

    expect(loadAudio).toHaveBeenCalledOnce();
    expect(playAudio).toHaveBeenCalledOnce();
    expect(radioBrowser.reportStationClick).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('.favorites-panel')).toBeNull();
  });

  it('should show an error and reset loading when a station cannot be fetched', async () => {
    radioBrowser.getRandomStation.mockRejectedValue(new Error('offline'));
    const fixture = createFixture();

    const button = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(button.disabled).toBe(true);

    await fixture.whenStable();
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('.status') as HTMLElement;

    expect(button.disabled).toBe(false);
    expect(status.textContent).toContain('The station could not be played. Try another one.');
    expect(loadAudio).not.toHaveBeenCalled();
    expect(playAudio).not.toHaveBeenCalled();
    expect(radioBrowser.reportStationClick).not.toHaveBeenCalled();
    expect(title.getTitle()).toBe('Random Radio - Discover Live Stations');
  });

  it('should keep the default page title when the station name is blank', async () => {
    const fixture = createFixture();
    await playRandomStation(fixture, createStation({ name: '   ' }));

    expect(title.getTitle()).toBe('Random Radio - Discover Live Stations');
  });

  it('should update the page title even when playback fails for a selected station', async () => {
    playAudio.mockRejectedValue(new Error('blocked'));
    const fixture = createFixture();
    await playRandomStation(fixture);

    expect(playAudio).toHaveBeenCalledOnce();
    expect(title.getTitle()).toBe('Random Radio - Station One');
  });

  it('should show a stream error only after a station has been selected', async () => {
    const fixture = createFixture();

    let status = fixture.nativeElement.querySelector('.status') as HTMLElement;
    expect(fixture.nativeElement.querySelector('audio')).toBeNull();
    expect(status.textContent).toContain('Ready when you are.');

    const audio = await playRandomStation(fixture);

    audio.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    status = fixture.nativeElement.querySelector('.status') as HTMLElement;

    expect(status.textContent).toContain('This stream stopped responding. Try another station.');
  });
});
