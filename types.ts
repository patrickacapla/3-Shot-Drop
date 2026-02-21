
export interface Vector {
  x: number;
  y: number;
}

export interface GameObject {
  pos: Vector;
  radius: number;
}

export interface Peg extends GameObject {}

export interface Slot {
  id: number;
  x: number;
  width: number;
  label: string;
  isOpened: boolean;
  isGlowing: boolean;
}

export enum GamePhase {
  READY = 'READY',
  DROPPING = 'DROPPING',
  REVEALING = 'REVEALING',
  FINISHED = 'FINISHED'
}
