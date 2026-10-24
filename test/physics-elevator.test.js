import { describe, expect, it } from "vitest";
import { startJump, integrateVertical, fallOutcome, moveWithWalls } from "../src/core/physics.js";
import { createElevators } from "../src/core/level.js";
import { updateElevator, callElevator, carFloor, elevatorCrushRisk } from "../src/core/elevator.js";
import { RNG } from "../src/core/rng.js";
import { FLOOR_Y } from "../src/core/constants.js";

describe("mall physics", () => {
  it("has a fair roughly 20 px jump arc and lands level", () => {
    const body = { x: 0, y: 32, w: 12, h: 24, grounded: true, vy: 0 };
    expect(startJump(body, true)).toBe(true); expect(body.jumpKick).toBe(true);
    let minY = body.y, landed = false;
    for (let i = 0; i < 90 && !landed; i++) {
      const result = integrateVertical(body, 56); minY = Math.min(minY, body.y); landed = result.landed;
    }
    expect(landed).toBe(true); expect(body.y).toBe(32); expect(32 - minY).toBeGreaterThan(17); expect(32 - minY).toBeLessThan(23);
    expect(body.jumpKick).toBe(false);
  });
  it("distinguishes safe and fatal falls", () => {
    expect(fallOutcome(48)).toBe("safe"); expect(fallOutcome(96)).toBe("fatal"); expect(fallOutcome(2)).toBe("none");
  });
  it("collides with solid counters and stays in world bounds", () => {
    const body = { x: 20, y: 20, w: 10, h: 10 };
    moveWithWalls(body, 10, 0, [{ x: 30, y: 10, w: 10, h: 30 }], { minX: 0, maxX: 100 });
    expect(body.x).toBe(20);
    moveWithWalls(body, -100, 0, [], { minX: 0, maxX: 100 }); expect(body.x).toBe(0);
  });
});

describe("elevators", () => {
  it("glides exactly to the next floor and dings once", () => {
    const car = createElevators(new RNG(1))[0]; car.occupied = true;
    const dings = [];
    for (let i = 0; i < 60; i++) {
      const result = updateElevator(car, { down: i === 0 }, new RNG(1)); if (result.ding) dings.push(result);
    }
    expect(car.y).toBe(FLOOR_Y["4F"]); expect(carFloor(car)).toBe("4F"); expect(dings).toHaveLength(1);
    for (let i = 0; i < 20; i++) expect(updateElevator(car, { down: false }, new RNG(1)).ding).toBe(false);
  });
  it("does not repeat a ding while held at the end of a shaft", () => {
    const car = createElevators(new RNG(1))[0]; car.occupied = true; car.y = FLOOR_Y.R;
    for (let i = 0; i < 10; i++) expect(updateElevator(car, { up: true }, new RNG(1)).ding).toBe(false);
  });
  it("calls an absent car to the caller's floor", () => {
    const car = createElevators(new RNG(1))[0]; car.y = FLOOR_Y["2F"];
    expect(callElevator(car, "R")).toBe(true);
    for (let i = 0; i < 200 && car.moving; i++) updateElevator(car, {}, new RNG(1));
    expect(carFloor(car)).toBe("R"); expect(car.called).toBe(false);
  });
  it("automatic cars wait with an occupant", () => {
    const car = createElevators(new RNG(1))[2]; car.occupied = true; car.wait = 1;
    updateElevator(car, {}, new RNG(1)); expect(car.wait).toBe(1); expect(car.moving).toBe(false);
    car.occupied = false; updateElevator(car, {}, new RNG(1)); expect(car.moving).toBe(true);
  });
  it("detects downward crushing but protects a called pickup", () => {
    const car = createElevators(new RNG(1))[0]; car.y = 80; car.moving = true; car.direction = 1;
    const body = { x: car.x + 4, y: 58, w: 12, h: 24 };
    expect(elevatorCrushRisk(car, body)).toBe(true);
    car.called = true; expect(elevatorCrushRisk(car, body)).toBe(false);
    car.called = false; car.direction = -1; expect(elevatorCrushRisk(car, body)).toBe(false);
  });
});
