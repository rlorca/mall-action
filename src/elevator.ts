// Elevator system

import { Floor, GameState } from './types';

export interface Elevator {
  id: string;
  shaftId: 'A' | 'B' | 'C';
  floors: Floor[];
  currentFloor: Floor;
  currentY: number; // pixel position
  moving: boolean;
  targetFloor: Floor | null;
  velocity: number;
  doorsOpen: boolean;
  doorsFrames: number;
  passengerId: string | null;
}

export const ELEVATOR_CONFIG = {
  A: { floors: ['R', '4F', '3F', '2F'], x: 200 },
  B: { floors: ['4F', '3F', '2F', '1F', 'P'], x: 400 },
  C: { floors: ['R', '4F', '3F', '2F', '1F'], x: 600, automatic: true },
};

const FLOOR_Y_MAP: Record<Floor, number> = {
  'R': 48,
  '4F': 96,
  '3F': 144,
  '2F': 192,
  '1F': 240,
  'P': 288,
};

export function createElevators(): Elevator[] {
  return [
    createElevator('A', ['R', '4F', '3F', '2F']),
    createElevator('B', ['4F', '3F', '2F', '1F', 'P']),
    createElevator('C', ['R', '4F', '3F', '2F', '1F']),
  ];
}

function createElevator(shaftId: 'A' | 'B' | 'C', floors: Floor[]): Elevator {
  return {
    id: `elevator-${shaftId}`,
    shaftId,
    floors,
    currentFloor: floors[0],
    currentY: FLOOR_Y_MAP[floors[0]],
    moving: false,
    targetFloor: null,
    velocity: 0,
    doorsOpen: true,
    doorsFrames: 0,
    passengerId: null,
  };
}

export function updateElevators(state: GameState, elevators: Elevator[], input: any) {
  elevators.forEach(elevator => {
    updateElevator(state, elevator, input);
  });
}

function updateElevator(state: GameState, elevator: Elevator, input: any) {
  // Doors close when moving
  if (elevator.moving) {
    elevator.doorsOpen = false;
  }

  // Manual control (player input)
  if (!elevator.moving && elevator.passengerId === state.player.id) {
    const moveUp = input.pressed.has('up');
    const moveDown = input.pressed.has('down');

    if (moveUp && elevator.currentFloor !== elevator.floors[0]) {
      // Move up
      const currentIdx = elevator.floors.indexOf(elevator.currentFloor);
      if (currentIdx > 0) {
        elevator.targetFloor = elevator.floors[currentIdx - 1];
        elevator.moving = true;
        elevator.velocity = -1; // Upward
      }
    } else if (moveDown && elevator.currentFloor !== elevator.floors[elevator.floors.length - 1]) {
      // Move down
      const currentIdx = elevator.floors.indexOf(elevator.currentFloor);
      if (currentIdx < elevator.floors.length - 1) {
        elevator.targetFloor = elevator.floors[currentIdx + 1];
        elevator.moving = true;
        elevator.velocity = 1; // Downward
      }
    }
  }

  // Move toward target floor
  if (elevator.moving && elevator.targetFloor) {
    const targetY = FLOOR_Y_MAP[elevator.targetFloor];
    elevator.currentY += elevator.velocity * 0.5; // Smooth movement

    // Check if reached target
    const reached = elevator.velocity > 0
      ? elevator.currentY >= targetY
      : elevator.currentY <= targetY;

    if (reached) {
      elevator.currentY = targetY;
      elevator.currentFloor = elevator.targetFloor;
      elevator.moving = false;
      elevator.velocity = 0;
      elevator.targetFloor = null;
      elevator.doorsOpen = true;
      elevator.doorsFrames = 0;
    }
  }

  // Automatic elevator C
  if (elevator.shaftId === 'C' && !elevator.moving && Math.random() < 0.002) {
    // ~3 second interval
    const currentIdx = elevator.floors.indexOf(elevator.currentFloor);
    const otherFloors = elevator.floors.filter((_, i) => i !== currentIdx);
    if (otherFloors.length > 0) {
      elevator.targetFloor = otherFloors[Math.floor(Math.random() * otherFloors.length)];
      elevator.moving = true;
      elevator.velocity = elevator.targetFloor > elevator.currentFloor ? 1 : -1;
    }
  }
}

export function getElevatorAtFloor(elevators: Elevator[], floor: Floor): Elevator | undefined {
  return elevators.find(e => e.currentFloor === floor && e.doorsOpen);
}

export function canUseElevator(floor: Floor, shaftId: 'A' | 'B' | 'C'): boolean {
  const config = ELEVATOR_CONFIG[shaftId];
  return (config.floors as Floor[]).includes(floor);
}
