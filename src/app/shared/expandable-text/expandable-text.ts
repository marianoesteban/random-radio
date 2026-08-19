import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';

interface TextMeasurement {
  hasOverflow: boolean;
  text: string;
}

const mobileViewportQuery = '(max-width: 34rem)';

@Component({
  selector: 'app-expandable-text',
  template: `{{ text() }}`,
  styleUrl: './expandable-text.css',
  host: {
    '[class.is-mobile]': 'isMobileViewport()',
    '[class.is-expandable]': 'canToggle()',
    '[class.is-expanded]': 'isExpanded()',
    '[style.--mobile-line-clamp]': 'mobileLineClamp()',
    '[attr.title]': 'hasOverflow() ? text() : null',
    '[attr.tabindex]': 'canToggle() ? 0 : null',
    '[attr.role]': "canToggle() ? 'button' : null",
    '[attr.aria-expanded]': 'canToggle() ? isExpanded() : null',
    '(click)': 'toggle()',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class ExpandableText {
  readonly text = input.required<string>();
  readonly mobileLineClamp = input(2);

  protected readonly hasOverflow = signal(false);
  protected readonly isExpanded = signal(false);
  protected readonly isMobileViewport = signal(false);
  protected readonly canToggle = computed(() => this.isMobileViewport() && this.hasOverflow());

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly resizeRevision = signal(0);
  private previousText = '';

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterRenderEffect({
      earlyRead: () => this.measure(),
      write: (measurement) => this.applyMeasurement(measurement()),
    });

    afterNextRender(() => this.observeResize(destroyRef));
    afterNextRender(() => this.observeViewport(destroyRef));
  }

  protected toggle(): void {
    if (this.canToggle()) {
      this.isExpanded.update((isExpanded) => !isExpanded);
    }
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (!this.canToggle() || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }

    event.preventDefault();
    this.toggle();
  }

  private measure(): TextMeasurement {
    this.resizeRevision();

    return {
      hasOverflow:
        this.isExpanded() ||
        this.element.scrollWidth > this.element.clientWidth ||
        this.element.scrollHeight > this.element.clientHeight,
      text: this.text(),
    };
  }

  private applyMeasurement(measurement: TextMeasurement): void {
    if (measurement.text !== this.previousText) {
      this.previousText = measurement.text;
      this.isExpanded.set(false);
    }

    this.hasOverflow.set(measurement.hasOverflow);
  }

  private observeResize(destroyRef: DestroyRef): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => this.resizeRevision.update((value) => value + 1));
    observer.observe(this.element);
    destroyRef.onDestroy(() => observer.disconnect());
  }

  private observeViewport(destroyRef: DestroyRef): void {
    if (typeof matchMedia === 'undefined') {
      return;
    }

    const mediaQuery = matchMedia(mobileViewportQuery);
    const updateViewport = () => {
      this.isMobileViewport.set(mediaQuery.matches);

      if (!mediaQuery.matches) {
        this.isExpanded.set(false);
      }

      this.resizeRevision.update((value) => value + 1);
    };

    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    destroyRef.onDestroy(() => mediaQuery.removeEventListener('change', updateViewport));
  }
}
