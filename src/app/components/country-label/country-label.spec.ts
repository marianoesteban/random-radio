import { TestBed } from '@angular/core/testing';
import { CountryLabel } from './country-label';

describe('CountryLabel', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CountryLabel],
    }).compileComponents();
  });

  it('should render a flag and display name for a valid country code', () => {
    const fixture = TestBed.createComponent(CountryLabel);
    fixture.componentRef.setInput('countryCode', 'ar');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.country-flag')?.textContent).toBe('🇦🇷');
    expect(compiled.textContent).toContain('Argentina');
  });

  it('should render the original value without a flag for invalid country codes', () => {
    const fixture = TestBed.createComponent(CountryLabel);
    fixture.componentRef.setInput('countryCode', 'not-a-code');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.country-flag')).toBeNull();
    expect(compiled.textContent).toContain('not-a-code');
  });

  it('should render Unknown without a flag for a blank country code', () => {
    const fixture = TestBed.createComponent(CountryLabel);
    fixture.componentRef.setInput('countryCode', '   ');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.country-flag')).toBeNull();
    expect(compiled.textContent?.trim()).toBe('Unknown');
  });
});
