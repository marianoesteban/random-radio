import { vi } from 'vitest';
import { AppTestSetup } from './testing/app-test-setup';

let setup: AppTestSetup;

beforeEach(async () => {
  setup = await AppTestSetup.create();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('shell and theme', () => {
  it('should create the app and render the shell heading', () => {
    const fixture = setup.createFixture();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance).toBeTruthy();
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Press play and land somewhere on the dial.',
    );
  });

  it('should update the theme UI when the toggle is clicked', () => {
    const fixture = setup.createFixture();
    const host = fixture.nativeElement as HTMLElement;
    const themeButton = host.querySelector('.theme-toggle') as HTMLButtonElement;

    expect(host.classList.contains('dark-theme')).toBe(false);
    expect(themeButton.getAttribute('aria-pressed')).toBe('false');
    expect(themeButton.getAttribute('aria-label')).toBe('Switch to dark theme');

    themeButton.click();
    fixture.detectChanges();

    expect(host.classList.contains('dark-theme')).toBe(true);
    expect(themeButton.getAttribute('aria-pressed')).toBe('true');
    expect(themeButton.getAttribute('aria-label')).toBe('Switch to light theme');

    themeButton.click();
    fixture.detectChanges();

    expect(host.classList.contains('dark-theme')).toBe(false);
    expect(themeButton.getAttribute('aria-pressed')).toBe('false');
    expect(themeButton.getAttribute('aria-label')).toBe('Switch to dark theme');
  });
});
