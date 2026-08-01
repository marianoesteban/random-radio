import { DestroyRef, inject, Service, signal } from '@angular/core';

@Service()
export class NotificationService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly notificationMessage = signal('');
  private notificationTimer: ReturnType<typeof setTimeout> | undefined;

  readonly message = this.notificationMessage.asReadonly();

  constructor() {
    this.destroyRef.onDestroy(() => this.cancelTimer());
  }

  show(message: string): void {
    this.cancelTimer();
    this.notificationMessage.set(message);
    this.notificationTimer = setTimeout(() => this.clear(), 5_000);
  }

  clear(): void {
    this.cancelTimer();
    this.notificationMessage.set('');
  }

  private cancelTimer(): void {
    if (this.notificationTimer === undefined) {
      return;
    }

    clearTimeout(this.notificationTimer);
    this.notificationTimer = undefined;
  }
}
