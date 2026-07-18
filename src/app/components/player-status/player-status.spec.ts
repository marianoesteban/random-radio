import { TestBed } from '@angular/core/testing';
import { PlayerStatus } from './player-status';

interface PlayerStatusInputs {
  error: string;
  isPlaying: boolean;
  isLoading: boolean;
  isTuning: boolean;
  hasStation: boolean;
}

function createFixture(inputs: PlayerStatusInputs) {
  const fixture = TestBed.createComponent(PlayerStatus);

  fixture.componentRef.setInput('error', inputs.error);
  fixture.componentRef.setInput('isPlaying', inputs.isPlaying);
  fixture.componentRef.setInput('isLoading', inputs.isLoading);
  fixture.componentRef.setInput('isTuning', inputs.isTuning);
  fixture.componentRef.setInput('hasStation', inputs.hasStation);
  fixture.detectChanges();

  return fixture;
}

describe('PlayerStatus', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayerStatus],
    }).compileComponents();
  });

  it('should prioritize rendering errors', () => {
    const fixture = createFixture({
      error: 'The station could not be played.',
      isPlaying: true,
      isLoading: true,
      isTuning: true,
      hasStation: true,
    });

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('The station could not be played.');
    expect(compiled.querySelector('.error')).not.toBeNull();
  });

  it('should render the playing state', () => {
    const fixture = createFixture({
      error: '',
      isPlaying: true,
      isLoading: false,
      isTuning: false,
      hasStation: true,
    });

    expect(fixture.nativeElement.textContent).toContain('Playing now.');
  });

  it('should render tuning, stopped, and ready states', () => {
    const tuningFixture = createFixture({
      error: '',
      isPlaying: false,
      isLoading: true,
      isTuning: false,
      hasStation: false,
    });
    const stoppedFixture = createFixture({
      error: '',
      isPlaying: false,
      isLoading: false,
      isTuning: false,
      hasStation: true,
    });
    const readyFixture = createFixture({
      error: '',
      isPlaying: false,
      isLoading: false,
      isTuning: false,
      hasStation: false,
    });

    expect(tuningFixture.nativeElement.textContent).toContain('Tuning in...');
    expect(stoppedFixture.nativeElement.textContent).toContain('Stopped.');
    expect(readyFixture.nativeElement.textContent).toContain('Ready when you are.');
  });
});
