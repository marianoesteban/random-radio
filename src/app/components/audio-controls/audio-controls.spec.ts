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
    fixture.componentRef.setInput('isMuted', false);
    fixture.componentRef.setInput('volume', 0.35);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.playback-action') as HTMLButtonElement;
    const volumeInput = fixture.nativeElement.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    const volumeButton = fixture.nativeElement.querySelector('.volume-action') as HTMLButtonElement;
    const volumeValue = fixture.nativeElement.querySelector('.volume-value') as HTMLElement;

    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-label')).toBe('Stop audio');
    expect(button.querySelector('.stop-icon')).not.toBeNull();
    expect(volumeInput.value).toBe('0.35');
    expect(volumeInput.getAttribute('aria-valuetext')).toBe('35% volume');
    expect(volumeButton.getAttribute('aria-label')).toBe('Mute audio');
    expect(volumeButton.getAttribute('aria-pressed')).toBe('false');
    expect(fixture.nativeElement.querySelector('.low-wave')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.high-wave')).toBeNull();
    expect(fixture.nativeElement.querySelector('.muted-mark')).toBeNull();
    expect(volumeValue.textContent).toContain('35%');
  });

  it('should display muted audio at zero and restore its retained level when unmuted', () => {
    const fixture = TestBed.createComponent(AudioControls);
    fixture.componentRef.setInput('isPlaying', false);
    fixture.componentRef.setInput('isMuted', true);
    fixture.componentRef.setInput('volume', 0.75);
    fixture.detectChanges();

    const volumeInput = fixture.nativeElement.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    const volumeButton = fixture.nativeElement.querySelector('.volume-action') as HTMLButtonElement;

    expect(volumeInput.value).toBe('0');
    expect(volumeInput.getAttribute('aria-valuetext')).toBe('Muted');
    expect(volumeButton.getAttribute('aria-label')).toBe('Unmute audio');
    expect(volumeButton.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('.muted-mark')).not.toBeNull();
    expect(
      (fixture.nativeElement.querySelector('.volume-value') as HTMLElement).textContent,
    ).toContain('0%');

    fixture.componentRef.setInput('isMuted', false);
    fixture.detectChanges();

    expect(volumeInput.value).toBe('0.75');
    expect(volumeButton.getAttribute('aria-label')).toBe('Mute audio');
    expect(fixture.nativeElement.querySelector('.muted-mark')).toBeNull();
    expect(fixture.nativeElement.querySelector('.low-wave')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.high-wave')).not.toBeNull();
  });

  it('should disable playback while loading', () => {
    const fixture = TestBed.createComponent(AudioControls);
    fixture.componentRef.setInput('disabled', true);
    fixture.componentRef.setInput('isPlaying', false);
    fixture.componentRef.setInput('isMuted', false);
    fixture.componentRef.setInput('volume', 1);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.playback-action') as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Play audio');
    expect(button.querySelector('.play-icon')).not.toBeNull();
  });

  it('should render a cancellable tuning indicator', () => {
    const fixture = TestBed.createComponent(AudioControls);
    fixture.componentRef.setInput('disabled', false);
    fixture.componentRef.setInput('isPlaying', false);
    fixture.componentRef.setInput('isTuning', true);
    fixture.componentRef.setInput('isMuted', false);
    fixture.componentRef.setInput('volume', 1);
    fixture.detectChanges();

    const controls = fixture.nativeElement.querySelector('.audio-controls') as HTMLElement;
    const button = fixture.nativeElement.querySelector('.playback-action') as HTMLButtonElement;

    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-label')).toBe('Cancel tuning');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(controls.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('.tuning-indicator')).not.toBeNull();
  });

  it('should emit playback, volume toggle, and volume change requests', () => {
    const fixture = TestBed.createComponent(AudioControls);
    const playbackHandler = vi.fn();
    const volumeToggleHandler = vi.fn();
    const volumeHandler = vi.fn();
    const volumeCommitHandler = vi.fn();

    fixture.componentInstance.playbackRequested.subscribe(playbackHandler);
    fixture.componentInstance.volumeToggleRequested.subscribe(volumeToggleHandler);
    fixture.componentInstance.volumeChanged.subscribe(volumeHandler);
    fixture.componentInstance.volumeChangeCommitted.subscribe(volumeCommitHandler);
    fixture.componentRef.setInput('disabled', false);
    fixture.componentRef.setInput('isPlaying', false);
    fixture.componentRef.setInput('isMuted', false);
    fixture.componentRef.setInput('volume', 1);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.playback-action') as HTMLButtonElement;
    const volumeInput = fixture.nativeElement.querySelector(
      'input[type="range"]',
    ) as HTMLInputElement;
    const volumeButton = fixture.nativeElement.querySelector('.volume-action') as HTMLButtonElement;

    button.click();
    volumeButton.click();
    volumeInput.value = '0.4';
    volumeInput.dispatchEvent(new Event('input'));
    volumeInput.dispatchEvent(new Event('change'));

    expect(playbackHandler).toHaveBeenCalledOnce();
    expect(volumeToggleHandler).toHaveBeenCalledOnce();
    expect(volumeHandler).toHaveBeenCalledWith(0.4);
    expect(volumeCommitHandler).toHaveBeenCalledWith(0.4);
  });
});
