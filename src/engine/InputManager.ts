/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MatAction } from '../types/game';
import { SETTINGS } from './settings';

export interface UnifiedInputState {
  actions: Record<MatAction, boolean>;
  triggers: Record<MatAction, boolean>; // True only on the frame the action was pressed
  intensity: number; // 0.0 to 1.0
  activeLane: number; // 0: Left, 1: Center, 2: Right
  hasGamepad: boolean;
  gamepadId: string;
  rawAxes: number[];
  rawButtons: boolean[];
}

export type UiNavDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SELECT' | 'BACK' | 'PAUSE';

type UiNavListener = (direction: UiNavDirection) => void;
type StateListener = (state: UnifiedInputState) => void;
type FirstInteractionListener = () => void;

class InputManagerService {
  private state: UnifiedInputState = {
    actions: { LEFT: false, RIGHT: false, CENTER: false, JUMP: false, SLIDE: false },
    triggers: { LEFT: false, RIGHT: false, CENTER: false, JUMP: false, SLIDE: false },
    intensity: 0.5, // Default base speed when idle
    activeLane: 1, // Default center
    hasGamepad: false,
    gamepadId: 'Keyboard Fallback',
    rawAxes: [0, 0, 0, 0],
    rawButtons: [],
  };

  private prevActions: Record<MatAction, boolean> = {
    LEFT: false,
    RIGHT: false,
    CENTER: false,
    JUMP: false,
    SLIDE: false,
  };

  // Keyboard state
  private keyState: Record<string, boolean> = {};

  // Cadence / step frequency detector for floor mat running
  private stepTimestamps: number[] = [];
  private lastStepTime = 0;
  private currentCadenceIntensity = 0.5;

  // TV D-Pad UI Navigation repeat throttle
  private lastNavTime = 0;
  private navThrottleMs = 180;
  private prevNavKeys: Record<string, boolean> = {};

  // Listeners
  private stateListeners: Set<StateListener> = new Set();
  private uiNavListeners: Set<UiNavListener> = new Set();
  private firstInteractionListeners: Set<FirstInteractionListener> = new Set();
  private hasInteracted = false;

  private rafId: number | null = null;

  constructor() {
    this.initKeyboard();
    this.startPolling();
  }

  private initKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      this.triggerFirstInteraction();
      this.keyState[e.code] = true;
      this.keyState[e.key] = true;

      // Handle keyboard UI navigation
      this.handleKeyboardNav(e);
    });

    window.addEventListener('keyup', (e) => {
      this.keyState[e.code] = false;
      this.keyState[e.key] = false;
    });

    window.addEventListener('gamepadconnected', (e) => {
      this.triggerFirstInteraction();
      console.log('Gamepad connected:', e.gamepad.id);
    });

    window.addEventListener('gamepaddisconnected', () => {
      console.log('Gamepad disconnected');
    });
  }

  private triggerFirstInteraction(): void {
    if (!this.hasInteracted) {
      this.hasInteracted = true;
      this.firstInteractionListeners.forEach((fn) => fn());
    }
  }

  public onFirstInteraction(listener: FirstInteractionListener): () => void {
    if (this.hasInteracted) {
      listener();
    }
    this.firstInteractionListeners.add(listener);
    return () => this.firstInteractionListeners.delete(listener);
  }

  public subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  public onUiNav(listener: UiNavListener): () => void {
    this.uiNavListeners.add(listener);
    return () => this.uiNavListeners.delete(listener);
  }

  public getState(): UnifiedInputState {
    return this.state;
  }

  private startPolling = (): void => {
    const loop = () => {
      this.poll();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  };

  public stop(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private handleKeyboardNav(e: KeyboardEvent): void {
    if (['ArrowUp', 'KeyW'].includes(e.code)) {
      this.dispatchUiNav('UP');
    } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
      this.dispatchUiNav('DOWN');
    } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
      this.dispatchUiNav('LEFT');
    } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
      this.dispatchUiNav('RIGHT');
    } else if (['Enter', 'Space'].includes(e.code)) {
      this.dispatchUiNav('SELECT');
    } else if (['Escape', 'Backspace'].includes(e.code)) {
      this.dispatchUiNav('BACK');
    } else if (['KeyP'].includes(e.code)) {
      this.dispatchUiNav('PAUSE');
    }
  }

  private dispatchUiNav(direction: UiNavDirection): void {
    this.uiNavListeners.forEach((fn) => fn(direction));
  }

  private poll(): void {
    const settings = SETTINGS.get();
    const map = settings.input;
    const now = performance.now();

    // 1. Read Gamepads
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;

    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        pad = gamepads[i];
        break;
      }
    }

    let leftPressed = false;
    let rightPressed = false;
    let centerPressed = false;
    let jumpPressed = false;
    let slidePressed = false;
    let rawIntensity = -1;

    let rawAxes: number[] = [0, 0, 0, 0];
    let rawButtons: boolean[] = [];

    if (pad) {
      rawAxes = Array.from(pad.axes || []);
      rawButtons = (pad.buttons || []).map((b) => (typeof b === 'object' ? b.pressed : b > 0.5));

      // Check if any button was pressed to unlock audio
      if (rawButtons.some(Boolean)) {
        this.triggerFirstInteraction();
      }

      // Check configured buttons
      leftPressed = !!rawButtons[map.leftButton];
      rightPressed = !!rawButtons[map.rightButton];
      centerPressed = !!rawButtons[map.centerButton];
      jumpPressed = !!rawButtons[map.jumpButton];
      slidePressed = !!rawButtons[map.slideButton];

      // Check axis inputs (analog stick or floor mat dpad axes)
      const axisX = rawAxes[map.axisX] ?? 0;
      const axisY = rawAxes[map.axisY] ?? 0;
      const deadzone = map.axisDeadzone;

      if (axisX < -deadzone) leftPressed = true;
      if (axisX > deadzone) rightPressed = true;

      const yVal = map.invertAxisY ? -axisY : axisY;
      if (yVal < -deadzone) jumpPressed = true;
      if (yVal > deadzone) slidePressed = true;

      // Handle standard D-Pad standard buttons (12=up, 13=down, 14=left, 15=right) if not already custom mapped
      if (rawButtons[12]) jumpPressed = true;
      if (rawButtons[13]) slidePressed = true;
      if (rawButtons[14]) leftPressed = true;
      if (rawButtons[15]) rightPressed = true;
      if (rawButtons[0]) centerPressed = true;

      // Direct axis intensity if configured
      if (map.intensityMode === 'axis' && map.axisIntensity >= 0 && map.axisIntensity < rawAxes.length) {
        // Map -1..1 or 0..1 to 0..1
        const raw = rawAxes[map.axisIntensity];
        rawIntensity = Math.max(0, Math.min(1, (raw + 1) / 2));
      } else if (map.intensityMode === 'trigger') {
        const trig = pad.buttons[7] ?? pad.buttons[6];
        if (trig) {
          rawIntensity = typeof trig === 'object' ? trig.value : Number(trig);
        }
      }

      // Poll D-Pad for Menu Navigation with repeat throttle
      this.pollGamepadUiNav(pad, now);
    }

    // 2. Keyboard Fallback integration
    const k = this.keyState;
    if (k['ArrowLeft'] || k['KeyA']) leftPressed = true;
    if (k['ArrowRight'] || k['KeyD']) rightPressed = true;
    if (k['KeyC'] || k['KeyX'] || k['Numpad5']) centerPressed = true;
    if (k['ArrowUp'] || k['KeyW'] || k['Space']) jumpPressed = true;
    if (k['ArrowDown'] || k['KeyS']) slidePressed = true;

    // Center is active if player is in middle or pressing center
    if (!leftPressed && !rightPressed && !jumpPressed && !slidePressed) {
      centerPressed = true;
    }

    // Determine Active Lane
    let activeLane = 1;
    if (leftPressed && !rightPressed) activeLane = 0;
    else if (rightPressed && !leftPressed) activeLane = 2;

    // Detect step strike for Cadence/Running Intensity
    const stepOccurred =
      (!this.prevActions.LEFT && leftPressed) ||
      (!this.prevActions.RIGHT && rightPressed) ||
      (!this.prevActions.CENTER && centerPressed) ||
      (!this.prevActions.JUMP && jumpPressed);

    if (stepOccurred) {
      if (now - this.lastStepTime > 120) {
        // Debounce foot contact
        this.stepTimestamps.push(now);
        this.lastStepTime = now;
      }
    }

    // Clean old steps (> 1800ms)
    this.stepTimestamps = this.stepTimestamps.filter((t) => now - t <= 1800);

    // Compute Cadence Intensity
    if (rawIntensity >= 0) {
      this.currentCadenceIntensity = rawIntensity;
    } else {
      // Steps per second
      const stepCount = this.stepTimestamps.length;
      const targetCadence = Math.min(1.0, Math.max(0.15, (stepCount / 1.8) / map.cadenceSensitivity));

      // Check keyboard overrides: holding shift or pressing 1..5
      let keyboardBoost = 0;
      if (k['ShiftLeft'] || k['ShiftRight']) keyboardBoost = 0.5;
      if (k['Digit1']) keyboardBoost = 0.2;
      if (k['Digit2']) keyboardBoost = 0.4;
      if (k['Digit3']) keyboardBoost = 0.6;
      if (k['Digit4']) keyboardBoost = 0.8;
      if (k['Digit5']) keyboardBoost = 1.0;

      const target = keyboardBoost > 0 ? keyboardBoost : targetCadence;
      // Smooth exponential filter
      this.currentCadenceIntensity += (target - this.currentCadenceIntensity) * 0.08;
    }

    const currentActions: Record<MatAction, boolean> = {
      LEFT: leftPressed,
      RIGHT: rightPressed,
      CENTER: centerPressed,
      JUMP: jumpPressed,
      SLIDE: slidePressed,
    };

    // Calculate Triggers (pressed this frame)
    const triggers: Record<MatAction, boolean> = {
      LEFT: !this.prevActions.LEFT && currentActions.LEFT,
      RIGHT: !this.prevActions.RIGHT && currentActions.RIGHT,
      CENTER: !this.prevActions.CENTER && currentActions.CENTER,
      JUMP: !this.prevActions.JUMP && currentActions.JUMP,
      SLIDE: !this.prevActions.SLIDE && currentActions.SLIDE,
    };

    this.prevActions = { ...currentActions };

    this.state = {
      actions: currentActions,
      triggers,
      intensity: Math.max(0, Math.min(1, this.currentCadenceIntensity)),
      activeLane,
      hasGamepad: !!pad,
      gamepadId: pad ? pad.id : 'Keyboard Fallback',
      rawAxes,
      rawButtons,
    };

    // Notify listeners
    this.stateListeners.forEach((fn) => fn(this.state));
  }

  private pollGamepadUiNav(pad: Gamepad, now: number): void {
    if (now - this.lastNavTime < this.navThrottleMs) return;

    const b = pad.buttons;
    const ax = pad.axes;
    const deadzone = 0.5;

    // Up: btn 12 or axis 1 < -0.5
    const isUp = (b[12] && b[12].pressed) || (ax[1] && ax[1] < -deadzone);
    // Down: btn 13 or axis 1 > 0.5
    const isDown = (b[13] && b[13].pressed) || (ax[1] && ax[1] > deadzone);
    // Left: btn 14 or axis 0 < -0.5
    const isLeft = (b[14] && b[14].pressed) || (ax[0] && ax[0] < -deadzone);
    // Right: btn 15 or axis 0 > 0.5
    const isRight = (b[15] && b[15].pressed) || (ax[0] && ax[0] > deadzone);

    // Select: btn 0 (A)
    const isSelect = b[0] && b[0].pressed;
    // Back: btn 1 (B)
    const isBack = b[1] && b[1].pressed;
    // Pause / Menu: btn 9 (Start) or btn 8 (Select)
    const isPause = (b[9] && b[9].pressed) || (b[8] && b[8].pressed);

    if (isUp && !this.prevNavKeys['UP']) {
      this.dispatchUiNav('UP');
      this.lastNavTime = now;
    } else if (isDown && !this.prevNavKeys['DOWN']) {
      this.dispatchUiNav('DOWN');
      this.lastNavTime = now;
    } else if (isLeft && !this.prevNavKeys['LEFT']) {
      this.dispatchUiNav('LEFT');
      this.lastNavTime = now;
    } else if (isRight && !this.prevNavKeys['RIGHT']) {
      this.dispatchUiNav('RIGHT');
      this.lastNavTime = now;
    } else if (isSelect && !this.prevNavKeys['SELECT']) {
      this.dispatchUiNav('SELECT');
      this.lastNavTime = now;
    } else if (isBack && !this.prevNavKeys['BACK']) {
      this.dispatchUiNav('BACK');
      this.lastNavTime = now;
    } else if (isPause && !this.prevNavKeys['PAUSE']) {
      this.dispatchUiNav('PAUSE');
      this.lastNavTime = now;
    }

    this.prevNavKeys = {
      UP: !!isUp,
      DOWN: !!isDown,
      LEFT: !!isLeft,
      RIGHT: !!isRight,
      SELECT: !!isSelect,
      BACK: !!isBack,
      PAUSE: !!isPause,
    };
  }
}

export const INPUT = new InputManagerService();
