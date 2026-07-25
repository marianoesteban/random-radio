import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AudioControls } from './audio-controls';

describe('AudioControls', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioControls],
    }).compileComponents();
  });

  it('should render the playback state and current volume', () => {
    const fixture = TestBed.createComponent(AudioControls);
    fixture.componentRef.setInput('disabled', false);
    fixture.componentRef.setInput('isPlaying', true);
    fixture.componentRef.setInput('volume', 0.35);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.playback-action') as HTMLButtonElement;
    const volumeInput = fixture.nativeElement.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    const volumeValue = fixture.nativeElement.querySelector('.volume-value') as HTMLElement;

    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-label')).toBe('Stop audio');
    expect(button.querySelector('.stop-icon')).not.toBeNull();
    expect(volumeInput.value).toBe('0.35');
    expect(volumeInput.getAttribute('aria-valuetext')).toBe('35% volume');
    expect(fixture.nativeElement.querySelector('.low-wave')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.high-wave')).toBeNull();
    expect(fixture.nativeElement.querySelector('.muted-mark')).toBeNull();
    expect(volumeValue.textContent).toContain('35%');
  });

  it('should reflect muted and high volume levels in the icon', () => {
    const fixture = TestBed.createComponent(AudioControls);
    fixture.componentRef.setInput('isPlaying', false);
    fixture.componentRef.setInput('volume', 0);
    fixture.detectChanges();

    const volumeInput = fixture.nativeElement.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;

    expect(volumeInput.getAttribute('aria-valuetext')).toBe('Muted');
    expect(fixture.nativeElement.querySelector('.muted-mark')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.low-wave')).toBeNull();

    fixture.componentRef.setInput('volume', 0.75);
    fixture.detectChanges();

    expect(volumeInput.getAttribute('aria-valuetext')).toBe('75% volume');
    expect(fixture.nativeElement.querySelector('.muted-mark')).toBeNull();
    expect(fixture.nativeElement.querySelector('.low-wave')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.high-wave')).not.toBeNull();
  });

  it('should disable playback while loading', () => {
    const fixture = TestBed.createComponent(AudioControls);
    fixture.componentRef.setInput('disabled', true);
    fixture.componentRef.setInput('isPlaying', false);
    fixture.componentRef.setInput('volume', 1);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.playback-action') as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Play audio');
    expect(button.querySelector('.play-icon')).not.toBeNull();
  });

  it('should emit playback and volume change requests', () => {
    const fixture = TestBed.createComponent(AudioControls);
    const playbackHandler = vi.fn();
    const volumeHandler = vi.fn();

    fixture.componentInstance.playbackRequested.subscribe(playbackHandler);
    fixture.componentInstance.volumeChanged.subscribe(volumeHandler);
    fixture.componentRef.setInput('disabled', false);
    fixture.componentRef.setInput('isPlaying', false);
    fixture.componentRef.setInput('volume', 1);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.playback-action') as HTMLButtonElement;
    const volumeInput = fixture.nativeElement.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;

    button.click();
    volumeInput.value = '0.4';
    volumeInput.dispatchEvent(new Event('input'));

    expect(playbackHandler).toHaveBeenCalledOnce();
    expect(volumeHandler).toHaveBeenCalledWith(0.4);
  });
});
