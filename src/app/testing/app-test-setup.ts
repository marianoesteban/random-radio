import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { type Mock, type MockInstance, vi } from 'vitest';
import { App } from '../app';
import { RadioStation, RadioStationSource } from '../models/radio-station';
import { RadioStationService } from '../services/radio-station-service';
import { LastPlayedStationStorage } from '../storage/last-played-station-storage';

export function createStation(overrides: Partial<RadioStation> = {}): RadioStation {
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

export async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

export class AppTestSetup {
  readonly stationService: {
    getRandomStation: Mock<() => Promise<RadioStation>>;
    canRefresh: Mock<(source: RadioStationSource) => boolean>;
    refreshStation: Mock<(station: RadioStation) => Promise<RadioStation>>;
    reportPlayback: Mock<(source: RadioStationSource) => Promise<void>>;
  };
  readonly lastPlayedStationStorage: {
    load: Mock<() => RadioStation | null>;
    save: Mock<(station: RadioStation) => void>;
  };
  readonly title: Title;
  readonly loadAudio: MockInstance<() => void>;
  readonly playAudio: MockInstance<() => Promise<void>>;
  readonly pauseAudio: MockInstance<() => void>;

  private constructor(
    stationService: AppTestSetup['stationService'],
    lastPlayedStationStorage: AppTestSetup['lastPlayedStationStorage'],
    title: Title,
    loadAudio: AppTestSetup['loadAudio'],
    playAudio: AppTestSetup['playAudio'],
    pauseAudio: AppTestSetup['pauseAudio'],
  ) {
    this.stationService = stationService;
    this.lastPlayedStationStorage = lastPlayedStationStorage;
    this.title = title;
    this.loadAudio = loadAudio;
    this.playAudio = playAudio;
    this.pauseAudio = pauseAudio;
  }

  static async create(): Promise<AppTestSetup> {
    document.title = 'Random Radio - Discover Live Stations';
    localStorage.clear();

    const stationService: AppTestSetup['stationService'] = {
      getRandomStation: vi.fn(),
      canRefresh: vi.fn((source) => source.provider === 'radio-browser'),
      refreshStation: vi.fn((station) => Promise.resolve(station)),
      reportPlayback: vi.fn(() => Promise.resolve()),
    };
    const lastPlayedStationStorage: AppTestSetup['lastPlayedStationStorage'] = {
      load: vi.fn(() => null),
      save: vi.fn(),
    };
    const loadAudio = vi
      .spyOn(HTMLMediaElement.prototype, 'load')
      .mockImplementation(() => undefined);
    const playAudio = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const pauseAudio = vi
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: RadioStationService, useValue: stationService },
        { provide: LastPlayedStationStorage, useValue: lastPlayedStationStorage },
      ],
    }).compileComponents();

    return new AppTestSetup(
      stationService,
      lastPlayedStationStorage,
      TestBed.inject(Title),
      loadAudio,
      playAudio,
      pauseAudio,
    );
  }

  createFixture(): ComponentFixture<App> {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    return fixture;
  }

  async settlePlayback(fixture: ComponentFixture<App>): Promise<void> {
    await fixture.whenStable();
    await flushPromises();
    fixture.detectChanges();
  }

  async playRandomStation(
    fixture: ComponentFixture<App>,
    station = createStation(),
  ): Promise<HTMLAudioElement> {
    this.stationService.getRandomStation.mockResolvedValue(station);

    const button = fixture.nativeElement.querySelector('.primary-action') as HTMLButtonElement;
    button.click();

    await this.settlePlayback(fixture);
    await this.settlePlayback(fixture);

    return fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
  }
}
