import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { RadioStation } from '../../models/radio-station';
import { StationCard } from './station-card';

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

describe('StationCard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StationCard],
    }).compileComponents();
  });

  it('should render station details and a safe homepage link', () => {
    const fixture = TestBed.createComponent(StationCard);
    fixture.componentRef.setInput(
      'station',
      createStation({ imageUrl: 'https://example.com/icon.png' }),
    );
    fixture.componentRef.setInput('isFavorite', false);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.station') as HTMLElement;
    const homepageLink = fixture.nativeElement.querySelector(
      '.station-logo-link',
    ) as HTMLAnchorElement;
    const logo = fixture.nativeElement.querySelector('.station-logo') as HTMLImageElement;
    const favoriteButton = fixture.nativeElement.querySelector(
      '.favorite-toggle',
    ) as HTMLButtonElement;
    const stationName = fixture.nativeElement.querySelector(
      '.station-details h2',
    ) as HTMLHeadingElement;

    expect(card.textContent).toContain('Station One');
    expect(stationName.hasAttribute('title')).toBe(false);
    expect(card.textContent).toContain('Argentina');
    expect(homepageLink.href).toBe('https://example.com/');
    expect(homepageLink.target).toBe('_blank');
    expect(homepageLink.rel).toContain('noopener');
    expect(homepageLink.rel).toContain('noreferrer');
    expect(homepageLink.getAttribute('aria-label')).toBe('Visit Station One homepage');
    expect(logo.src).toBe('https://example.com/icon.png');
    expect(favoriteButton.getAttribute('aria-pressed')).toBe('false');
    expect(favoriteButton.getAttribute('aria-label')).toBe('Add Station One to favorites');
    expect(favoriteButton.dataset['tooltip']).toBe('Add to favorites');
  });

  it('should render a fallback logo and no link for unsafe homepages', () => {
    const fixture = TestBed.createComponent(StationCard);
    fixture.componentRef.setInput('station', createStation({ homepageUrl: 'javascript:alert(1)' }));
    fixture.componentRef.setInput('isFavorite', true);
    fixture.detectChanges();

    const fallbackLogo = fixture.nativeElement.querySelector('.fallback') as HTMLElement;
    const favoriteButton = fixture.nativeElement.querySelector(
      '.favorite-toggle',
    ) as HTMLButtonElement;

    expect(fixture.nativeElement.querySelector('.station-logo-link')).toBeNull();
    expect(fallbackLogo.textContent).toContain('RR');
    expect(favoriteButton.classList.contains('is-favorite')).toBe(true);
    expect(favoriteButton.getAttribute('aria-pressed')).toBe('true');
    expect(favoriteButton.getAttribute('aria-label')).toBe('Remove Station One from favorites');
    expect(favoriteButton.dataset['tooltip']).toBe('Remove from favorites');
  });

  it('should emit the station when the favorite button is clicked', () => {
    const station = createStation();
    const fixture = TestBed.createComponent(StationCard);
    const favoriteHandler = vi.fn();

    fixture.componentInstance.favoriteToggled.subscribe(favoriteHandler);
    fixture.componentRef.setInput('station', station);
    fixture.componentRef.setInput('isFavorite', false);
    fixture.detectChanges();

    const favoriteButton = fixture.nativeElement.querySelector(
      '.favorite-toggle',
    ) as HTMLButtonElement;
    favoriteButton.click();

    expect(favoriteHandler).toHaveBeenCalledWith(station);
  });
});
