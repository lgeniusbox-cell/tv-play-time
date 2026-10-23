/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class ProceduralVideoGenerator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private frame = 0;
  private playbackRate = 1.0;

  constructor(width = 1280, height = 720) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Could not create 2D context');
    this.ctx = context;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.2, Math.min(4.0, rate));
  }

  public render(type: string, dt = 0.016): void {
    this.frame += dt * 60 * this.playbackRate;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();

    if (type.includes('highway') || type.includes('cyber')) {
      this.renderCyberHighway(ctx, w, h);
    } else if (type.includes('rhythm')) {
      this.renderRhythmGrid(ctx, w, h);
    } else if (type.includes('jump')) {
      this.renderForestJump(ctx, w, h);
    } else if (type.includes('slide')) {
      this.renderForestSlide(ctx, w, h);
    } else if (type.includes('hit')) {
      this.renderForestHit(ctx, w, h);
    } else if (type.includes('win')) {
      this.renderForestWin(ctx, w, h);
    } else {
      // Default forest run / generic run
      this.renderForestRun(ctx, w, h);
    }

    ctx.restore();
  }

  private renderCyberHighway(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.45);
    skyGrad.addColorStop(0, '#030712');
    skyGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.45);

    // Distant Neon Grid Horizon
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1;
    const horizonY = h * 0.42;

    // Distant mountains / skyline
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let x = 0; x <= w; x += 60) {
      const peak = Math.sin(x * 0.01) * 35 + Math.cos(x * 0.03) * 20;
      ctx.lineTo(x, horizonY - Math.abs(peak));
    }
    ctx.lineTo(w, horizonY);
    ctx.closePath();
    ctx.fill();

    // Glowing Synth Sun
    const sunGrad = ctx.createRadialGradient(w / 2, horizonY, 10, w / 2, horizonY, 140);
    sunGrad.addColorStop(0, 'rgba(6, 182, 212, 0.7)');
    sunGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.25)');
    sunGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(w / 2 - 160, horizonY - 140, 320, 160);

    // Ground Road perspective
    const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    groundGrad.addColorStop(0, '#070b14');
    groundGrad.addColorStop(1, '#02040a');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Highway boundaries
    const roadTopLeft = w * 0.42;
    const roadTopRight = w * 0.58;
    const roadBottomLeft = w * 0.08;
    const roadBottomRight = w * 0.92;

    ctx.fillStyle = '#0b0f19';
    ctx.beginPath();
    ctx.moveTo(roadTopLeft, horizonY);
    ctx.lineTo(roadTopRight, horizonY);
    ctx.lineTo(roadBottomRight, h);
    ctx.lineTo(roadBottomLeft, h);
    ctx.closePath();
    ctx.fill();

    // Road glowing edge rails
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(roadTopLeft, horizonY);
    ctx.lineTo(roadBottomLeft, h);
    ctx.moveTo(roadTopRight, horizonY);
    ctx.lineTo(roadBottomRight, h);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Moving horizontal grid lines (perspective speed)
    const offset = (this.frame * 0.08) % 1;
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 2;

    for (let i = 0; i < 16; i++) {
      const t = (i + offset) / 16;
      // Exponential curve for perspective
      const p = Math.pow(t, 2.2);
      const y = horizonY + (h - horizonY) * p;
      const lx = roadTopLeft + (roadBottomLeft - roadTopLeft) * p;
      const rx = roadTopRight + (roadBottomRight - roadTopRight) * p;

      ctx.beginPath();
      ctx.moveTo(lx, y);
      ctx.lineTo(rx, y);
      ctx.stroke();
    }

    // 3 Lanes dividers
    const lane1Top = roadTopLeft + (roadTopRight - roadTopLeft) * (1 / 3);
    const lane1Bot = roadBottomLeft + (roadBottomRight - roadBottomLeft) * (1 / 3);
    const lane2Top = roadTopLeft + (roadTopRight - roadTopLeft) * (2 / 3);
    const lane2Bot = roadBottomLeft + (roadBottomRight - roadBottomLeft) * (2 / 3);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.setLineDash([15, 20]);
    ctx.lineDashOffset = -(this.frame * 4) % 35;
    ctx.beginPath();
    ctx.moveTo(lane1Top, horizonY);
    ctx.lineTo(lane1Bot, h);
    ctx.moveTo(lane2Top, horizonY);
    ctx.lineTo(lane2Bot, h);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private renderRhythmGrid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Pulse background
    const pulse = (Math.sin(this.frame * 0.1) + 1) * 0.5;
    ctx.fillStyle = `rgb(${10 + pulse * 15}, ${5 + pulse * 8}, ${22 + pulse * 25})`;
    ctx.fillRect(0, 0, w, h);

    // Neon concentric pulsating hexagons / tunnel
    const cx = w / 2;
    const cy = h / 2;

    for (let r = 80; r < w * 0.7; r += 70) {
      const wave = (r + this.frame * 3) % (w * 0.7);
      const alpha = Math.max(0, 1 - wave / (w * 0.7));
      ctx.strokeStyle = `rgba(168, 85, 247, ${alpha * 0.7})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, wave, wave * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Equalizer spectrum columns along bottom
    const barCount = 32;
    const barWidth = w / barCount;
    for (let b = 0; b < barCount; b++) {
      const bh = Math.abs(Math.sin(b * 0.4 + this.frame * 0.15)) * (h * 0.35);
      const grad = ctx.createLinearGradient(0, h - bh, 0, h);
      grad.addColorStop(0, '#f43f5e');
      grad.addColorStop(0.5, '#a855f7');
      grad.addColorStop(1, '#3b82f6');
      ctx.fillStyle = grad;
      ctx.fillRect(b * barWidth + 3, h - bh, barWidth - 6, bh);
    }
  }

  private renderForestRun(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Moonlit night sky
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#021814');
    sky.addColorStop(0.6, '#064e3b');
    sky.addColorStop(1, '#021510');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Parallax trees in background
    ctx.fillStyle = '#01241c';
    for (let x = -100; x < w + 100; x += 110) {
      const offset = (x - (this.frame * 2) % 220);
      ctx.fillRect(offset, 40, 24, h - 140);
    }

    // Ground
    ctx.fillStyle = '#01140e';
    ctx.fillRect(0, h - 140, w, 140);

    // Running character silhouette & glow
    const charX = w * 0.28;
    const charY = h - 140;
    const bob = Math.sin(this.frame * 0.3) * 8;

    // Body
    ctx.fillStyle = '#34d399';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(charX, charY - 60 + bob, 18, 0, Math.PI * 2); // Head
    ctx.fill();

    // Torso
    ctx.fillRect(charX - 10, charY - 45 + bob, 20, 36);

    // Running legs
    const legPhase = this.frame * 0.3;
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(charX - 5, charY - 12 + bob);
    ctx.lineTo(charX - 5 + Math.sin(legPhase) * 22, charY);
    ctx.moveTo(charX + 5, charY - 12 + bob);
    ctx.lineTo(charX + 5 - Math.sin(legPhase) * 22, charY);
    ctx.stroke();

    ctx.shadowBlur = 0;
  }

  private renderForestJump(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.renderForestRun(ctx, w, h);
    // Draw JUMP high action aura
    const charX = w * 0.28;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(charX, h - 220, 48, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('LEAPING OVER ROOT!', charX + 55, h - 215);
  }

  private renderForestSlide(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.renderForestRun(ctx, w, h);
    // Draw SLIDE duck trail
    const charX = w * 0.28;
    ctx.fillStyle = 'rgba(234, 179, 8, 0.3)';
    ctx.fillRect(charX - 50, h - 150, 100, 30);
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('SLIDING UNDER BRANCH!', charX + 55, h - 145);
  }

  private renderForestHit(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.renderForestRun(ctx, w, h);
    // Red flash impact
    ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px sans-serif';
    ctx.fillText('STUMBLE!', w * 0.5 - 90, h * 0.4);
  }

  private renderForestWin(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.renderForestRun(ctx, w, h);
    // Gold celebration
    ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px sans-serif';
    ctx.fillText('TRIAL COMPLETE! VICTORY!', w * 0.5 - 280, h * 0.4);
  }
}
