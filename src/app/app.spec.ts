import { TestBed } from '@angular/core/testing';
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
  let loadAudio: MockInstance<() => void>;
  let playAudio: MockInstance<() => Promise<void>>;

  beforeEach(async () => {
    radioBrowser = {
      getRandomStation: vi.fn(),
      streamUrl: vi.fn((station) => station.url_resolved || station.url),
      reportStationClick: vi.fn(() => Promise.resolve()),
    };
    loadAudio = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    playAudio = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: RadioBrowser, useValue: radioBrowser }],
    }).compileComponents();
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

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
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

    expect(radioBrowser.getRandomStation).toHaveBeenCalledOnce();
    expect(radioBrowser.streamUrl).toHaveBeenCalledWith(station);
    expect(audio.src).toBe('https://stream.example.com/live');
    expect(loadAudio).toHaveBeenCalledOnce();
    expect(playAudio).toHaveBeenCalledOnce();
    expect(radioBrowser.reportStationClick).toHaveBeenCalledWith('station-1');
    expect(button.disabled).toBe(false);
    expect(status.textContent).toContain('Now playing Station One');
    expect(stationCard.textContent).toContain('Station One');
    expect(stationCard.textContent).toContain('AR');
    expect(stationCard.textContent).toContain('Spanish');
    expect(stationCard.textContent).toContain('MP3');
    expect(stationCard.textContent).toContain('128 kbps');
  });

  it('should show an error and reset loading when a station cannot be fetched', async () => {
    radioBrowser.getRandomStation.mockRejectedValue(new Error('offline'));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
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

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    audio.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    status = fixture.nativeElement.querySelector('.status') as HTMLElement;

    expect(status.textContent).toContain('This stream stopped responding. Try another station.');
  });
});
