import { GameContext, StoreDef, FixtureDef } from "./types";
import { VirtualPadState } from "../input/input";
import { PRNG } from "../utils/prng";
import { createStoreDefs, generateStoreFixtures } from "./stores";
import { COPY } from "../text/copy";

export class GameEngine {
  public ctx: GameContext;
  public prng: PRNG;
  private currentStoreFixtures: FixtureDef[] = [];
  private visitedStoresFirstTime: Set<string> = new Set();
  private storeFirstVisitLines: string[] | null = null;
  private storeFirstVisitTimer: number = 0;
  private levelClearTriggered: boolean = false;
  private gameStonkDone: boolean = false;

  constructor(seed: number = 1337) {
    this.prng = new PRNG(seed);
    this.ctx = this.createInitialContext();
  }

  public setSeed(seed: number): void {
    this.prng.setSeed(seed);
    this.ctx = this.createInitialContext();
  }

  private createInitialContext(): GameContext {
    return {
      screen: "SPLASH",
      score: 0,
      highScore: 0,
      lives: 3,
      packagesFound: 0,
      currentLoop: 1,
      isBlackFriday: false,
      continuesLeft: 3,
      continueCountdown: 9,
      levelTimeFrames: 0,
      alarmTriggered: false,
      paTimer: 3600, // Every ~60 seconds
      paBanner: null,
      currentStore: null,
      inventory: [],
      photoStripFound: false,
      cameraX: 0,
      cameraY: 0,
      agent: {
        x: 60,
        y: 8, // Roof floor Y
        vx: 0,
        vy: 0,
        floor: 5, // 5 = Roof, 4=4F, 3=3F, 2=2F, 1=1F, 0=P
        isDucking: false,
        isJumping: false,
        isJumpKicking: false,
        isSliding: false,
        facing: 1,
        invulnerableTimer: 0,
        searchTimer: 0,
        searchingFixtureId: null,
        weapon: "NORMAL",
        weaponTimer: 0,
        hasArmor: false,
        speedTimer: 0,
        hasRadar: false,
        cinnabombTimer: 0,
      },
      spies: [],
      playerBullets: [],
      enemyBullets: [],
      elevators: [
        { shaftId: "A", floors: [2, 3, 4, 5], currentFloorIndex: 3, targetFloorIndex: 3, y: 8, movingDirection: 0, doorsOpen: true, dinged: false, waitTimer: 0 },
        { shaftId: "B", floors: [0, 1, 2, 3, 4], currentFloorIndex: 4, targetFloorIndex: 4, y: 8, movingDirection: 0, doorsOpen: true, dinged: false, waitTimer: 0 },
        { shaftId: "C", floors: [1, 2, 3, 4, 5], currentFloorIndex: 4, targetFloorIndex: 4, y: 8, movingDirection: 0, doorsOpen: true, dinged: false, waitTimer: 120 }
      ],
      coins: [],
      floatingTexts: [],
      stores: createStoreDefs(),
    };
  }

  /**
   * Main Fixed 60Hz Game Tick.
   */
  public update(pad: VirtualPadState): void {
    // Process High Score
    if (this.ctx.score > this.ctx.highScore) {
      this.ctx.highScore = this.ctx.score;
    }

    switch (this.ctx.screen) {
      case "TITLE":
        this.updateTitleScreen(pad);
        break;
      case "MALL":
        this.updateMallScreen(pad);
        break;
      case "STORE":
        this.updateStoreScreen(pad);
        break;
      case "MAP":
        if (pad.select || pad.start) {
          this.ctx.screen = this.ctx.currentStore ? "STORE" : "MALL";
        }
        break;
      case "PAUSE":
        if (pad.start) {
          this.ctx.screen = this.ctx.currentStore ? "STORE" : "MALL";
        }
        break;
      case "CLEAR":
        if (pad.start) {
          this.startNextLoop();
        }
        break;
      case "CONTINUE":
        this.updateContinueScreen(pad);
        break;
      case "GAMEOVER":
        if (pad.start) {
          this.ctx = this.createInitialContext();
          this.ctx.screen = "TITLE";
        }
        break;
    }
  }

  private updateTitleScreen(pad: VirtualPadState): void {
    if (pad.start) {
      this.ctx.screen = "MALL";
      this.levelClearTriggered = false;
    }
  }

  private updateMallScreen(pad: VirtualPadState): void {
    if (pad.start) {
      this.ctx.screen = "PAUSE";
      return;
    }
    if (pad.select) {
      this.ctx.screen = "MAP";
      return;
    }

    this.ctx.levelTimeFrames++;

    // Timers
    this.updatePowerupTimers();

    // Alarm Check
    const alarmThreshold = Math.max(3600, 9000 - (this.ctx.currentLoop - 1) * 1200);
    if (!this.ctx.alarmTriggered && this.ctx.levelTimeFrames > alarmThreshold) {
      this.ctx.alarmTriggered = true;
      this.addFloatingText("ALARM! SECURITY ALERTED", 128, 40, "#FF8170");
    }

    // Agent Physics & Movement
    const agent = this.ctx.agent;
    const speed = agent.speedTimer > 0 ? 2 : 1;

    if (agent.invulnerableTimer > 0) agent.invulnerableTimer--;

    // Movement
    if (pad.left) {
      agent.vx = -speed;
      agent.facing = -1;
    } else if (pad.right) {
      agent.vx = speed;
      agent.facing = 1;
    } else {
      agent.vx = 0;
    }

    // Ducking & Jumping
    agent.isDucking = pad.down && !agent.isJumping;
    if (pad.b && !agent.isJumping) {
      agent.isJumping = true;
      agent.vy = -5;
      agent.isJumpKicking = agent.vx !== 0;
    }

    // Apply gravity & velocity
    if (agent.isJumping) {
      agent.vy += 0.3; // Gravity
      agent.y += agent.vy;

      // Floor landing check (Floors 48px apart)
      const floorY = this.getFloorY(agent.floor);
      if (agent.y >= floorY) {
        agent.y = floorY;
        agent.vy = 0;
        agent.isJumping = false;
        agent.isJumpKicking = false;
      }
    } else {
      agent.x += agent.vx;
    }

    // Keep Agent within Mall Boundaries [0, 768 - 16]
    agent.x = Math.max(0, Math.min(768 - 16, agent.x));

    // Player Shooting (A button)
    if (pad.a && this.ctx.playerBullets.length < (agent.weapon === "RAPID" ? 4 : 2)) {
      const bY = agent.isDucking ? agent.y + 16 : agent.y + 8;
      this.ctx.playerBullets.push({
        x: agent.facing === 1 ? agent.x + 16 : agent.x - 4,
        y: bY,
        vx: agent.facing * 4,
      });
      if (agent.weapon === "SPREAD") {
        this.ctx.playerBullets.push({
          x: agent.facing === 1 ? agent.x + 16 : agent.x - 4,
          y: bY - 4,
          vx: agent.facing * 4,
          vy: -1
        });
        this.ctx.playerBullets.push({
          x: agent.facing === 1 ? agent.x + 16 : agent.x - 4,
          y: bY + 4,
          vx: agent.facing * 4,
          vy: 1
        });
      }
    }

    // Update Player Bullets
    this.ctx.playerBullets.forEach((b) => {
      b.x += b.vx;
      if (b.vy) b.y += b.vy;
    });
    this.ctx.playerBullets = this.ctx.playerBullets.filter((b) => b.x >= 0 && b.x <= 768);

    // Update Elevators
    this.updateElevators(pad);

    // Update Spies AI
    this.updateSpies();

    // Check Store Entrance (Up button near store door)
    if (pad.up) {
      const storeNear = this.ctx.stores.find(
        (s) => Math.abs(agent.x - s.x) < 20 && agent.floor === s.floor && s.role !== "CLOSED"
      );
      if (storeNear) {
        this.enterStore(storeNear);
        return;
      }

      // Check Parking Exit (At wagon on Floor P=0)
      if (agent.floor === 0 && Math.abs(agent.x - 680) < 30) {
        this.tryExitLevel();
      }
    }

    // Camera follow
    this.ctx.cameraX = Math.max(0, Math.min(768 - 256, agent.x - 120));
  }

  private enterStore(store: StoreDef): void {
    this.ctx.currentStore = store;
    this.ctx.screen = "STORE";
    this.currentStoreFixtures = generateStoreFixtures(store, this.prng, this.ctx.isBlackFriday);

    // First Visit Store Dialogue
    if (!this.visitedStoresFirstTime.has(store.name)) {
      this.visitedStoresFirstTime.add(store.name);
      this.storeFirstVisitLines = COPY.FIRST_VISIT_STORE_LINES[store.name] || null;
      this.storeFirstVisitTimer = 180;
    }

    // GameStonk Easter Egg
    if (store.id === "gamestonk" && !this.gameStonkDone) {
      this.gameStonkDone = true;
      const jokeItems = [
        "EXPIRED COUPON", "PRE-OWNED GUIDE", "PET ROCK", "MOOD RING", "1 SHARE (DOWN 99%)"
      ];
      const item = this.prng.randChoice(jokeItems);
      this.ctx.inventory.push(item);
      this.ctx.score += 1;
      this.addFloatingText(`YOU GOT: ${item}!`, 128, 60, "#EA9E22");
    }

    // Reset Agent Store Position (Bottom Center)
    this.ctx.agent.x = 120;
    this.ctx.agent.y = 150;
  }

  public getStoreFirstVisitLines(): string[] | null {
    return this.storeFirstVisitLines;
  }

  private updateStoreScreen(pad: VirtualPadState): void {
    if (pad.start) {
      this.ctx.screen = "PAUSE";
      return;
    }
    if (pad.select) {
      this.ctx.screen = "MAP";
      return;
    }

    this.updatePowerupTimers();

    const agent = this.ctx.agent;
    const speed = agent.speedTimer > 0 ? 2 : 1;

    // First Visit Speech Bubble Timer
    if (this.storeFirstVisitTimer > 0) {
      this.storeFirstVisitTimer--;
    }

    // Top-down 4-directional Movement
    if (pad.left) {
      agent.vx = -speed;
      agent.facing = -1;
    } else if (pad.right) {
      agent.vx = speed;
      agent.facing = 1;
    } else {
      agent.vx = 0;
    }

    if (pad.up) {
      agent.vy = -speed;
    } else if (pad.down) {
      agent.vy = speed;
    } else {
      agent.vy = 0;
    }

    agent.x += agent.vx;
    agent.y += agent.vy;

    // Room Collision Bounds (16x11 room tiles)
    agent.x = Math.max(16, Math.min(256 - 32, agent.x));
    agent.y = Math.max(16, Math.min(176 - 32, agent.y));

    // Exit Door at Bottom Center
    if (agent.y > 154 && Math.abs(agent.x - 120) < 16) {
      this.ctx.screen = "MALL";
      this.ctx.currentStore = null;
      return;
    }

    // Search Fixtures (Single Tap B)
    if (pad.b && agent.searchTimer === 0) {
      const touchFixture = this.currentStoreFixtures.find(
        (f) => !f.searched && Math.abs(agent.x - f.x) < 24 && Math.abs(agent.y - f.y) < 24
      );
      if (touchFixture) {
        agent.searchingFixtureId = touchFixture.id;
        agent.searchTimer = 45; // ~0.75 seconds
      }
    }

    // Search Progress
    if (agent.searchTimer > 0) {
      agent.searchTimer--;
      if (agent.searchTimer === 0 && agent.searchingFixtureId) {
        const fixture = this.currentStoreFixtures.find((f) => f.id === agent.searchingFixtureId);
        if (fixture) {
          fixture.searched = true;
          this.processSearchContent(fixture);
        }
        agent.searchingFixtureId = null;
      }
    }
  }

  private processSearchContent(fixture: FixtureDef): void {
    if (fixture.content === "PACKAGE") {
      this.ctx.packagesFound++;
      this.ctx.score += 500;
      this.addFloatingText(`PACKAGE ${this.ctx.packagesFound}/6!`, 128, 60, "#FF8170");
      if (this.ctx.currentStore) {
        this.ctx.currentStore.cleared = true;
      }
    } else if (fixture.content === "POWERUP" && fixture.powerupType) {
      this.applyPowerUp(fixture.powerupType);
      this.ctx.score += 50;
      this.addFloatingText(`GOT ${fixture.powerupType}!`, 128, 60, "#3FC1E8");
    } else if (fixture.content === "TRAP") {
      this.ctx.agent.invulnerableTimer = 60; // Stunned 1s
      this.addFloatingText("IT'S A TRAP!", 128, 60, "#FF8170");
    } else {
      this.addFloatingText("NOTHING HERE", 128, 60, "#ADADAD");
    }
  }

  public applyPowerUp(type: string): void {
    const a = this.ctx.agent;
    switch (type) {
      case "RAPID":
        a.weapon = "RAPID";
        a.weaponTimer = 1200; // 20s
        break;
      case "SPREAD":
        a.weapon = "SPREAD";
        a.weaponTimer = 1200; // 20s
        break;
      case "ARMOR":
      case "PRETZEL":
        a.hasArmor = true;
        break;
      case "SNEAKERS":
      case "JULIOOZE":
        a.speedTimer = 1200;
        break;
      case "RADAR":
        a.hasRadar = true;
        break;
      case "ONEUP":
        this.ctx.lives++;
        break;
      case "CINNABOMB":
        a.cinnabombTimer = 360; // 6s
        break;
    }
  }

  private updatePowerupTimers(): void {
    const a = this.ctx.agent;
    if (a.weaponTimer > 0) {
      a.weaponTimer--;
      if (a.weaponTimer === 0) a.weapon = "NORMAL";
    }
    if (a.speedTimer > 0) a.speedTimer--;
    if (a.cinnabombTimer > 0) a.cinnabombTimer--;
  }

  private updateElevators(pad: VirtualPadState): void {
    this.ctx.elevators.forEach((car) => {
      // Manual Driving for Shafts A and B when Agent is inside
      if (car.shaftId !== "C" && Math.abs(this.ctx.agent.x - (car.shaftId === "A" ? 180 : 340)) < 16) {
        if (pad.up && car.currentFloorIndex < car.floors.length - 1) {
          car.y = Math.max(8, car.y - 1);
        } else if (pad.down && car.currentFloorIndex > 0) {
          car.y = Math.min(200, car.y + 1);
        }
      }

      // Automatic Shaft C
      if (car.shaftId === "C") {
        if (car.waitTimer > 0) {
          car.waitTimer--;
        } else {
          car.targetFloorIndex = this.prng.randInt(0, car.floors.length - 1);
          car.waitTimer = 180;
        }
      }
    });
  }

  private updateSpies(): void {
    const maxSpies = this.ctx.isBlackFriday ? 8 : 4;

    // Spawn Spies
    if (this.ctx.spies.length < maxSpies && this.prng.random() < 0.01) {
      this.ctx.spies.push({
        id: this.prng.randInt(1000, 9999),
        x: this.ctx.agent.x + (this.prng.random() < 0.5 ? 100 : -100),
        y: this.getFloorY(this.ctx.agent.floor),
        vx: 1,
        floor: this.ctx.agent.floor,
        facing: 1,
        aimingTimer: 0,
        shotTimer: 150,
        isDucking: false,
        isDying: false,
        deathTimer: 0,
        speechBubble: null,
        speechTimer: 0,
      });
    }

    // Update existing Spies
    this.ctx.spies.forEach((spy) => {
      if (spy.isDying) {
        spy.deathTimer--;
        return;
      }

      // Walk toward player
      if (Math.abs(spy.x - this.ctx.agent.x) > 40) {
        spy.vx = spy.x < this.ctx.agent.x ? 1 : -1;
        spy.x += spy.vx;
        spy.facing = spy.vx as 1 | -1;
      }

      // Shooting logic
      if (spy.shotTimer > 0) spy.shotTimer--;
      if (spy.shotTimer === 0) {
        spy.aimingTimer = 30; // 0.5s aim pose
        spy.shotTimer = 150;
      }

      if (spy.aimingTimer > 0) {
        spy.aimingTimer--;
        if (spy.aimingTimer === 0) {
          this.ctx.enemyBullets.push({
            x: spy.facing === 1 ? spy.x + 16 : spy.x - 4,
            y: spy.y + 8,
            vx: spy.facing * 2
          });
        }
      }
    });

    this.ctx.spies = this.ctx.spies.filter((s) => !s.isDying || s.deathTimer > 0);
  }

  public tryExitLevel(): void {
    if (this.ctx.packagesFound >= 6) {
      if (!this.levelClearTriggered) {
        this.levelClearTriggered = true;
        this.ctx.score += 1000; // Clear bonus
        this.ctx.screen = "CLEAR";
      }
    } else {
      this.addFloatingText(`PACKAGES LEFT: ${6 - this.ctx.packagesFound}`, 128, 40, "#FF8170");
    }
  }

  private startNextLoop(): void {
    this.ctx.currentLoop++;
    this.ctx.packagesFound = 0;
    this.ctx.levelTimeFrames = 0;
    this.ctx.alarmTriggered = false;
    this.ctx.stores = createStoreDefs();
    this.levelClearTriggered = false;
    this.ctx.screen = "MALL";
    this.ctx.agent.x = 60;
    this.ctx.agent.y = 8;
    this.ctx.agent.floor = 5;
  }

  private updateContinueScreen(pad: VirtualPadState): void {
    if (this.ctx.continueCountdown > 0 && this.ctx.levelTimeFrames % 60 === 0) {
      this.ctx.continueCountdown--;
    }

    if (pad.start) {
      this.ctx.lives = 3;
      this.ctx.continuesLeft--;
      this.ctx.continueCountdown = 9;
      this.ctx.screen = "MALL";
      this.ctx.agent.x = 60;
      this.ctx.agent.y = 8;
    } else if (this.ctx.continueCountdown === 0) {
      this.ctx.screen = "GAMEOVER";
    }
  }

  public killAgent(): void {
    if (this.ctx.agent.hasArmor) {
      this.ctx.agent.hasArmor = false;
      this.ctx.agent.invulnerableTimer = 60;
      return;
    }

    this.ctx.lives--;
    if (this.ctx.lives <= 0) {
      if (this.ctx.continuesLeft > 0) {
        this.ctx.screen = "CONTINUE";
        this.ctx.continueCountdown = 9;
      } else {
        this.ctx.screen = "GAMEOVER";
      }
    } else {
      this.ctx.agent.x = 60;
      this.ctx.agent.y = this.getFloorY(this.ctx.agent.floor);
      this.ctx.agent.invulnerableTimer = 120;
    }
  }

  public getFloorY(floor: number): number {
    const floorYMap: Record<number, number> = {
      5: 8,   // Roof
      4: 56,  // 4F
      3: 104, // 3F
      2: 152, // 2F
      1: 200, // 1F
      0: 200  // Parking
    };
    return floorYMap[floor] ?? 200;
  }

  public addFloatingText(text: string, x: number, y: number, color: string): void {
    this.ctx.floatingTexts.push({
      id: Math.random(),
      text,
      x,
      y,
      color,
      timer: 60
    });
  }
}
