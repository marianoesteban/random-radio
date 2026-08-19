import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { NotificationService } from './notification-service';

describe('NotificationService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show and automatically clear a notification after five seconds', () => {
    const notifications = TestBed.inject(NotificationService);

    notifications.show('Something happened.');

    expect(notifications.message()).toBe('Something happened.');

    vi.advanceTimersByTime(5_000);

    expect(notifications.message()).toBe('');
  });

  it('should restart the dismissal timer when another notification is shown', () => {
    const notifications = TestBed.inject(NotificationService);

    notifications.show('First message.');
    vi.advanceTimersByTime(4_000);
    notifications.show('Second message.');
    vi.advanceTimersByTime(1_000);

    expect(notifications.message()).toBe('Second message.');

    vi.advanceTimersByTime(4_000);

    expect(notifications.message()).toBe('');
  });

  it('should clear a notification explicitly', () => {
    const notifications = TestBed.inject(NotificationService);

    notifications.show('Something happened.');
    notifications.clear();

    expect(notifications.message()).toBe('');
  });
});
