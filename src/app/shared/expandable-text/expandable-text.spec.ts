import { TestBed } from '@angular/core/testing';
import { afterEach, vi } from 'vitest';
import { ExpandableText } from './expandable-text';

function mockViewport(matches: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(
      (media: string): MediaQueryList =>
        ({
          matches,
          media,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(() => false),
        }) as unknown as MediaQueryList,
    ),
  );
}

describe('ExpandableText', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpandableText],
    }).compileComponents();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('should stay non-interactive when the text fits', () => {
    mockViewport(true);

    const fixture = TestBed.createComponent(ExpandableText);
    fixture.componentRef.setInput('text', 'Short name');
    fixture.detectChanges();

    expect(fixture.nativeElement.classList.contains('is-mobile')).toBe(true);
    expect(fixture.nativeElement.hasAttribute('role')).toBe(false);
    expect(fixture.nativeElement.hasAttribute('tabindex')).toBe(false);
    expect(fixture.nativeElement.hasAttribute('title')).toBe(false);
  });

  it('should only show a tooltip for overflowing desktop text', () => {
    mockViewport(false);

    const fixture = TestBed.createComponent(ExpandableText);
    fixture.componentRef.setInput('text', 'Station One');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    Object.defineProperties(element, {
      clientWidth: { configurable: true, get: () => 100 },
      scrollWidth: { configurable: true, get: () => 200 },
    });

    fixture.componentRef.setInput('text', 'A long station name');
    fixture.detectChanges();

    expect(element.title).toBe('A long station name');
    expect(element.classList.contains('is-mobile')).toBe(false);
    expect(element.hasAttribute('role')).toBe(false);
    expect(element.hasAttribute('tabindex')).toBe(false);

    element.click();
    fixture.detectChanges();

    expect(element.classList.contains('is-expanded')).toBe(false);
  });

  it('should expand overflowing text by touch or keyboard', () => {
    mockViewport(true);

    const fixture = TestBed.createComponent(ExpandableText);
    fixture.componentRef.setInput('text', 'Station One');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    Object.defineProperties(element, {
      clientHeight: { configurable: true, get: () => 20 },
      clientWidth: { configurable: true, get: () => 100 },
      scrollHeight: { configurable: true, get: () => 40 },
      scrollWidth: { configurable: true, get: () => 100 },
    });

    fixture.componentRef.setInput('text', 'A station name that takes more than two lines');
    fixture.detectChanges();

    expect(element.title).toBe('A station name that takes more than two lines');
    expect(element.getAttribute('role')).toBe('button');
    expect(element.tabIndex).toBe(0);
    expect(element.getAttribute('aria-expanded')).toBe('false');

    element.click();
    fixture.detectChanges();

    expect(element.classList.contains('is-expanded')).toBe(true);
    expect(element.getAttribute('aria-expanded')).toBe('true');

    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(element.classList.contains('is-expanded')).toBe(false);
    expect(element.getAttribute('aria-expanded')).toBe('false');

    element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    fixture.detectChanges();

    expect(element.classList.contains('is-expanded')).toBe(true);
    expect(element.getAttribute('aria-expanded')).toBe('true');
  });

  it('should collapse when the text changes', () => {
    mockViewport(true);

    const fixture = TestBed.createComponent(ExpandableText);
    fixture.componentRef.setInput('text', 'Station One');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    Object.defineProperties(element, {
      clientWidth: { configurable: true, get: () => 100 },
      scrollWidth: { configurable: true, get: () => 200 },
    });

    fixture.componentRef.setInput('text', 'A long station name');
    fixture.detectChanges();
    element.click();
    fixture.detectChanges();

    fixture.componentRef.setInput('text', 'A different long station name');
    fixture.detectChanges();

    expect(element.classList.contains('is-expanded')).toBe(false);
    expect(element.getAttribute('aria-expanded')).toBe('false');
  });
});
