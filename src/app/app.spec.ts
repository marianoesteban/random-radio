import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { type Mock, type MockInstance, vi } from 'vitest';
import { App } from './app';
import { RadioBrowser, RadioStation } from './radio-browser';

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

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('App', () => {
  let radioBrowser: {
    getRandomStation: Mock<() => Promise<RadioStation>>;
    streamUrl: Mock<(station: RadioStation) => string>;
    reportStationClick: Mock<(stationUuid: string) => Promise<void>>;
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
      streamUrl: vi.fn((station) => station.url_resolved || station.url),
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

  async function playRandomStation(
    fixture: ComponentFixture<App>,
    station = createStation(),
  ): Promise<HTMLAudioElement> {
    radioBrowser.getRandomStation.mockResolvedValue(station);

    const button = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    button.click();

    await fixture.whenStable();
    await flushPromises();
    fixture.detectChanges();

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

    await fixture.whenStable();
    await flushPromises();
    fixture.detectChanges();

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;

    expect(radioBrowser.getRandomStation).toHaveBeenCalledOnce();
    expect(radioBrowser.streamUrl).toHaveBeenCalledWith(station);
    expect(audio.src).toBe('https://stream.example.com/live');
    expect(audio.hasAttribute('controls')).toBe(false);
    expect(loadAudio).toHaveBeenCalledOnce();
    expect(playAudio).toHaveBeenCalledOnce();
    expect(radioBrowser.reportStationClick).toHaveBeenCalledWith('station-1');
    expect(title.getTitle()).toBe('Random Radio - Station One');
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain('Play a Random Station');
    expect(fixture.nativeElement.querySelector('app-station-card')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-audio-controls')).not.toBeNull();
  });

  it('should pause and resume the current station without selecting a new one', async () => {
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

    playbackButton.click();

    await fixture.whenStable();
    await flushPromises();

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

    let favorites = JSON.parse(
      localStorage.getItem('random-radio:favorites') ?? '[]',
    ) as RadioStation[];

    expect(favorites).toEqual([station]);

    favoriteButton.click();
    fixture.detectChanges();

    favorites = JSON.parse(
      localStorage.getItem('random-radio:favorites') ?? '[]',
    ) as RadioStation[];

    expect(favorites).toEqual([]);
  });

  it('should load a favorite station and play it when selected', async () => {
    const station = createStation({ stationuuid: 'favorite-1', name: 'Saved Station' });
    localStorage.setItem('random-radio:favorites', JSON.stringify([station]));
    const fixture = createFixture();

    const menuButton = fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement;
    menuButton.click();
    fixture.detectChanges();

    const favoriteButton = fixture.nativeElement.querySelector(
      '.favorite-station',
    ) as HTMLButtonElement;
    favoriteButton.click();

    await fixture.whenStable();
    await flushPromises();
    fixture.detectChanges();

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;

    expect(radioBrowser.getRandomStation).not.toHaveBeenCalled();
    expect(radioBrowser.streamUrl).toHaveBeenCalledWith(station);
    expect(audio.src).toBe('https://stream.example.com/live');
    expect(loadAudio).toHaveBeenCalledOnce();
    expect(playAudio).toHaveBeenCalledOnce();
    expect(radioBrowser.reportStationClick).toHaveBeenCalledWith('favorite-1');
    expect(title.getTitle()).toBe('Random Radio - Saved Station');
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
    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    audio.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    let status = fixture.nativeElement.querySelector('.status') as HTMLElement;
    expect(status.textContent).toContain('Ready when you are.');

    await playRandomStation(fixture);

    audio.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    status = fixture.nativeElement.querySelector('.status') as HTMLElement;

    expect(status.textContent).toContain('This stream stopped responding. Try another station.');
  });
});
