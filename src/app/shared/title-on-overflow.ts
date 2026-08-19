import {
  afterNextRender,
  afterRenderEffect,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';

@Directive({
  selector: '[appTitleOnOverflow]',
})
export class TitleOnOverflow {
  readonly appTitleOnOverflow = input.required<string>();

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly resizeRevision = signal(0);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterRenderEffect({
      earlyRead: () => {
        this.resizeRevision();

        return {
          isOverflowing: this.element.scrollWidth > this.element.clientWidth,
          text: this.appTitleOnOverflow(),
        };
      },
      write: (measurement) => {
        const { isOverflowing, text } = measurement();

        if (isOverflowing) {
          this.element.title = text;
        } else {
          this.element.removeAttribute('title');
        }
      },
    });

    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') {
        return;
      }

      const observer = new ResizeObserver(() => this.resizeRevision.update((value) => value + 1));
      observer.observe(this.element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
