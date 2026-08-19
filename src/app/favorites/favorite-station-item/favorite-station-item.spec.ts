import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { RadioStation } from '../../radio/radio-station';
import { FavoriteStationItem } from './favorite-station-item';

function createStation(overrides: Partial<RadioStation> = {}): RadioStation {
  return {
    source: {
      provider: 'radio-browser',
      externalId: 'station-1',
    },
    name: 'Station One',
    streamUrl: 'https://stream.example.com/live',
    homepageUrl: 'https://example.com',
    imageUrl: 'https://example.com/station.png',
    countryCode: 'AR',
    ...overrides,
  };
}

describe('FavoriteStationItem', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FavoriteStationItem],
    }).compileComponents();
  });

  it('should render the station and emit it when selected', () => {
    const station = createStation();
    const fixture = TestBed.createComponent(FavoriteStationItem);
    const selectionHandler = vi.fn();

    fixture.componentInstance.stationSelected.subscribe(selectionHandler);
    fixture.componentRef.setInput('station', station);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.favorite-station') as HTMLButtonElement;
    const image = fixture.nativeElement.querySelector('.favorite-image img') as HTMLImageElement;
    const name = fixture.nativeElement.querySelector('.favorite-name') as HTMLElement;

    expect(button.textContent).toContain('Station One');
    expect(button.textContent).toContain('Argentina');
    expect(button.getAttribute('aria-label')).toBe('Play favorite station Station One');
    expect(name.hasAttribute('title')).toBe(false);
    expect(image.src).toBe('https://example.com/station.png');
    expect(image.alt).toBe('');
    expect(image.getAttribute('loading')).toBe('lazy');
    expect(image.getAttribute('decoding')).toBe('async');

    button.click();

    expect(selectionHandler).toHaveBeenCalledWith(station);
  });

  it('should show a fallback for a missing or failed station image', () => {
    const missingImageFixture = TestBed.createComponent(FavoriteStationItem);
    missingImageFixture.componentRef.setInput('station', createStation({ imageUrl: '' }));
    missingImageFixture.detectChanges();

    expect(
      missingImageFixture.nativeElement.querySelector('.favorite-image-fallback').textContent,
    ).toContain('RR');

    const failedImageFixture = TestBed.createComponent(FavoriteStationItem);
    failedImageFixture.componentRef.setInput('station', createStation());
    failedImageFixture.detectChanges();

    const failedImage = failedImageFixture.nativeElement.querySelector(
      '.favorite-image img',
    ) as HTMLImageElement;
    failedImage.dispatchEvent(new Event('error'));
    failedImageFixture.detectChanges();

    expect(failedImageFixture.nativeElement.querySelector('.favorite-image img')).toBeNull();
    expect(
      failedImageFixture.nativeElement.querySelector('.favorite-image-fallback').textContent,
    ).toContain('RR');
  });

  it('should disable the station button when disabled', () => {
    const fixture = TestBed.createComponent(FavoriteStationItem);
    fixture.componentRef.setInput('station', createStation());
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.favorite-station') as HTMLButtonElement;

    expect(button.disabled).toBe(true);
  });

  it('should identify the station being tuned without exposing implementation details', () => {
    const fixture = TestBed.createComponent(FavoriteStationItem);
    fixture.componentRef.setInput('station', createStation());
    fixture.componentRef.setInput('disabled', true);
    fixture.componentRef.setInput('isTuning', true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.favorite-station') as HTMLButtonElement;
    const indicator = fixture.nativeElement.querySelector('.selected-indicator') as HTMLElement;

    expect(button.getAttribute('aria-label')).toBe('Tuning to Station One');
    expect(indicator.textContent).toContain('Tuning...');
    expect(indicator.hasAttribute('role')).toBe(false);
    expect(button.textContent).not.toContain('refresh');
  });

  it('should distinguish the selected station without disabling it', () => {
    const fixture = TestBed.createComponent(FavoriteStationItem);
    fixture.componentRef.setInput('station', createStation());
    fixture.componentRef.setInput('isSelected', true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.favorite-station') as HTMLButtonElement;
    const indicator = fixture.nativeElement.querySelector('.selected-indicator') as HTMLElement;

    expect(button.classList.contains('is-selected')).toBe(true);
    expect(button.getAttribute('aria-current')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe(
      'Play currently selected favorite station Station One',
    );
    expect(button.disabled).toBe(false);
    expect(indicator.textContent).toContain('Selected');
  });

  it('should show Unknown when the station has no country code', () => {
    const fixture = TestBed.createComponent(FavoriteStationItem);
    fixture.componentRef.setInput('station', createStation({ countryCode: '' }));
    fixture.detectChanges();

    const country = fixture.nativeElement.querySelector('.favorite-country') as HTMLElement;

    expect(country.textContent).toContain('Unknown');
  });
});
