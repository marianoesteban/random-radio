import { TestBed } from '@angular/core/testing';
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

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the player heading', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Press play and land somewhere on the dial.',
    );
  });

  it('should start a random station and report the click', async () => {
    const station = createStation();
    radioBrowser.getRandomStation.mockResolvedValue(station);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Loading...');

    await fixture.whenStable();
    await flushPromises();
    fixture.detectChanges();

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    const status = fixture.nativeElement.querySelector('.status') as HTMLElement;
    const stationCard = fixture.nativeElement.querySelector('.station') as HTMLElement;
    const homepageLink = fixture.nativeElement.querySelector(
      '.station-logo-link',
    ) as HTMLAnchorElement;

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
    expect(status.textContent).toContain('Tuning in...');

    audio.dispatchEvent(new Event('playing'));
    fixture.detectChanges();

    expect(status.textContent).toContain('Playing now.');
    expect(stationCard.textContent).toContain('Station One');
    expect(stationCard.querySelector('.country-flag')?.textContent).toBe('🇦🇷');
    expect(stationCard.textContent).toContain('Argentina');
    expect(homepageLink.href).toBe('https://example.com/');
    expect(homepageLink.target).toBe('_blank');
    expect(homepageLink.rel).toContain('noopener');
    expect(homepageLink.rel).toContain('noreferrer');
    expect(homepageLink.getAttribute('aria-label')).toBe('Visit Station One homepage');
    expect(homepageLink.querySelector('.station-logo')).not.toBeNull();
  });

  it('should pause and resume the current station without selecting a new one', async () => {
    const station = createStation();
    radioBrowser.getRandomStation.mockResolvedValue(station);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const randomButton = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    randomButton.click();

    await fixture.whenStable();
    await flushPromises();

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    audio.dispatchEvent(new Event('playing'));
    fixture.detectChanges();

    const playbackButton = fixture.nativeElement.querySelector(
      '.playback-action',
    ) as HTMLButtonElement;
    const status = fixture.nativeElement.querySelector('.status') as HTMLElement;

    expect(randomButton.textContent).toContain('Play a Random Station');
    expect(playbackButton.getAttribute('aria-label')).toBe('Stop current station');
    expect(playbackButton.querySelector('.stop-icon')).not.toBeNull();

    playbackButton.click();
    fixture.detectChanges();

    expect(pauseAudio).toHaveBeenCalledOnce();
    expect(playbackButton.getAttribute('aria-label')).toBe('Start current station');
    expect(playbackButton.querySelector('.play-icon')).not.toBeNull();
    expect(status.textContent).toContain('Stopped.');
    expect(status.textContent).not.toContain('Tuning in...');

    playbackButton.click();

    await fixture.whenStable();
    await flushPromises();
    fixture.detectChanges();

    expect(playAudio).toHaveBeenCalledTimes(2);
    expect(radioBrowser.getRandomStation).toHaveBeenCalledOnce();
    expect(playbackButton.getAttribute('aria-label')).toBe('Stop current station');
    expect(playbackButton.querySelector('.stop-icon')).not.toBeNull();
  });

  it('should update the audio volume from the custom volume control', async () => {
    const station = createStation();
    radioBrowser.getRandomStation.mockResolvedValue(station);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    button.click();

    await fixture.whenStable();
    await flushPromises();
    fixture.detectChanges();

    const volumeInput = fixture.nativeElement.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    volumeInput.value = '0.35';
    volumeInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    const volumeValue = fixture.nativeElement.querySelector('.volume-value') as HTMLElement;

    expect(audio.volume).toBe(0.35);
    expect(volumeValue.textContent).toContain('35%');
  });

  it('should save and remove the current station as a favorite', async () => {
    const station = createStation();
    radioBrowser.getRandomStation.mockResolvedValue(station);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const randomButton = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    randomButton.click();

    await fixture.whenStable();
    await flushPromises();
    fixture.detectChanges();

    const favoriteButton = fixture.nativeElement.querySelector(
      '.favorite-toggle',
    ) as HTMLButtonElement;

    expect(favoriteButton.getAttribute('aria-pressed')).toBe('false');
    expect(favoriteButton.getAttribute('aria-label')).toBe('Add Station One to favorites');
    expect(favoriteButton.dataset['tooltip']).toBe('Add to favorites');

    favoriteButton.click();
    fixture.detectChanges();

    let favorites = JSON.parse(
      localStorage.getItem('random-radio:favorites') ?? '[]',
    ) as RadioStation[];

    expect(favorites).toEqual([station]);
    expect(favoriteButton.getAttribute('aria-pressed')).toBe('true');
    expect(favoriteButton.getAttribute('aria-label')).toBe('Remove Station One from favorites');
    expect(favoriteButton.dataset['tooltip']).toBe('Remove from favorites');
    expect(fixture.nativeElement.querySelector('.favorite-station')).toBeNull();

    const menuButton = fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement;
    menuButton.click();
    fixture.detectChanges();

    let favoriteStation = fixture.nativeElement.querySelector('.favorite-station') as HTMLElement;
    expect(favoriteStation.textContent).toContain('Station One');

    favoriteButton.click();
    fixture.detectChanges();

    favorites = JSON.parse(localStorage.getItem('random-radio:favorites') ?? '[]') as RadioStation[];
    favoriteStation = fixture.nativeElement.querySelector('.favorite-station') as HTMLElement;

    expect(favorites).toEqual([]);
    expect(favoriteStation).toBeNull();
    expect(favoriteButton.getAttribute('aria-pressed')).toBe('false');
    expect(favoriteButton.getAttribute('aria-label')).toBe('Add Station One to favorites');
    expect(favoriteButton.dataset['tooltip']).toBe('Add to favorites');
  });

  it('should load favorite stations and play one when selected', async () => {
    const station = createStation({ stationuuid: 'favorite-1', name: 'Saved Station' });
    localStorage.setItem('random-radio:favorites', JSON.stringify([station]));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const menuButton = fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement;
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('.favorite-station')).toBeNull();

    menuButton.click();
    fixture.detectChanges();

    const favoriteButton = fixture.nativeElement.querySelector(
      '.favorite-station',
    ) as HTMLButtonElement;

    expect(favoriteButton.textContent).toContain('Saved Station');
    expect(menuButton.getAttribute('aria-expanded')).toBe('true');

    favoriteButton.click();

    await fixture.whenStable();
    await flushPromises();
    fixture.detectChanges();

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    const stationCard = fixture.nativeElement.querySelector('.station') as HTMLElement;

    expect(radioBrowser.getRandomStation).not.toHaveBeenCalled();
    expect(radioBrowser.streamUrl).toHaveBeenCalledWith(station);
    expect(audio.src).toBe('https://stream.example.com/live');
    expect(loadAudio).toHaveBeenCalledOnce();
    expect(playAudio).toHaveBeenCalledOnce();
    expect(radioBrowser.reportStationClick).toHaveBeenCalledWith('favorite-1');
    expect(title.getTitle()).toBe('Random Radio - Saved Station');
    expect(stationCard.textContent).toContain('Saved Station');
    expect(fixture.nativeElement.querySelector('.favorites-panel')).toBeNull();
  });

  it('should not render a homepage link when the station homepage is missing', async () => {
    const station = createStation({ homepage: '   ' });
    radioBrowser.getRandomStation.mockResolvedValue(station);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    button.click();

    await fixture.whenStable();
    await flushPromises();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.station-logo-link')).toBeNull();
    expect(fixture.nativeElement.querySelector('.station-logo')).not.toBeNull();
  });

  it('should not render a homepage link for non-web URLs', async () => {
    const station = createStation({ homepage: 'javascript:alert(1)' });
    radioBrowser.getRandomStation.mockResolvedValue(station);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    button.click();

    await fixture.whenStable();
    await flushPromises();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.station-logo-link')).toBeNull();
    expect(fixture.nativeElement.querySelector('.station-logo')).not.toBeNull();
  });

  it('should show an error and reset loading when a station cannot be fetched', async () => {
    radioBrowser.getRandomStation.mockRejectedValue(new Error('offline'));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

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
    const station = createStation({ name: '   ' });
    radioBrowser.getRandomStation.mockResolvedValue(station);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    button.click();

    await fixture.whenStable();
    await flushPromises();

    expect(title.getTitle()).toBe('Random Radio - Discover Live Stations');
  });

  it('should update the page title even when playback fails for a selected station', async () => {
    const station = createStation();
    radioBrowser.getRandomStation.mockResolvedValue(station);
    playAudio.mockRejectedValue(new Error('blocked'));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    button.click();

    await fixture.whenStable();
    await flushPromises();

    expect(title.getTitle()).toBe('Random Radio - Station One');
  });

  it('should show a stream error only after a station has been selected', async () => {
    const station = createStation();
    radioBrowser.getRandomStation.mockResolvedValue(station);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    audio.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    let status = fixture.nativeElement.querySelector('.status') as HTMLElement;
    expect(status.textContent).toContain('Ready when you are.');

    const button = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    audio.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    status = fixture.nativeElement.querySelector('.status') as HTMLElement;

    expect(status.textContent).toContain('This stream stopped responding. Try another station.');
  });
});
