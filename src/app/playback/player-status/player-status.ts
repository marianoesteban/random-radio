import { Component, input } from '@angular/core';

@Component({
  selector: 'app-player-status',
  templateUrl: './player-status.html',
  styleUrl: './player-status.css',
})
export class PlayerStatus {
  readonly error = input.required<string>();
  readonly isPlaying = input.required<boolean>();
  readonly isLoading = input.required<boolean>();
  readonly isTuning = input.required<boolean>();
  readonly hasStation = input.required<boolean>();
}
