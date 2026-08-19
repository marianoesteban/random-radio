import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TitleOnOverflow } from './title-on-overflow';

@Component({
  imports: [TitleOnOverflow],
  template: `<span [appTitleOnOverflow]="name()">{{ name() }}</span>`,
})
class TestHost {
  readonly name = signal('Station One');
}

describe('TitleOnOverflow', () => {
  it('should only show a title when the text overflows', () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();

    const element = fixture.nativeElement.querySelector('span') as HTMLSpanElement;
    let scrollWidth = 200;

    Object.defineProperties(element, {
      clientWidth: { configurable: true, get: () => 100 },
      scrollWidth: { configurable: true, get: () => scrollWidth },
    });

    fixture.componentInstance.name.set('A long station name');
    fixture.detectChanges();
    expect(element.title).toBe('A long station name');

    scrollWidth = 100;
    fixture.componentInstance.name.set('Short name');
    fixture.detectChanges();
    expect(element.hasAttribute('title')).toBe(false);
  });
});
