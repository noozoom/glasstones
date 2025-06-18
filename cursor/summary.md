# GlassTones Development Summary

## Project Overview
GlassTones is a p5.js + Tone.js browser game featuring visual fog effects and musical interactions where users draw lines that create sound when hit by a bouncing ball.

## Critical Architecture Lessons

### ❌ **WRONG: Separate Preview Layer Approach**
```javascript
// BAD: This doesn't work because fog layer covers preview
draftLayer.clear();
draftLayer.image(fogLayer, 0, 0);  // Copy fog
draftLayer.erase(255, LINE_ERASE_ALPHA);  // Draw transparent line
// Result: Preview invisible under fog layer
```

**Problem**: Drawing order is Background → Fog → Preview, so transparent preview is hidden under opaque fog.

### ✅ **CORRECT: Direct Fog Layer Preview**
```javascript
// GOOD: Draw preview directly on fog layer temporarily
fogLayer.push();
fogLayer.erase(255, LINE_ERASE_ALPHA * 0.7);  // Temporary transparency
fogLayer.stroke(255);
fogLayer.line(p1.x, p1.y, p2.x, p2.y);  // Draw on fog directly
fogLayer.noErase();
fogLayer.pop();
```

**Why it works**: Preview transparency is applied directly to the fog layer, so it's visible immediately. When drawing completes, the final line overwrites the preview.

## Core Concept
**"Frosted glass traced by finger"** - The fog represents frosted glass, and drawing creates transparent areas showing the background through the glass.

## Technical Architecture

### Rendering Layers (Correct Order)
1. **Background Image**: Shiseido advertisement with aspect ratio preservation
2. **Fog Layer**: Semi-transparent overlay (Mobile: 200α, PC: 210α)
   - Contains permanent line transparency
   - Contains temporary preview transparency
   - Self-recovers slowly with REFOG_ALPHA=3
3. **Game Objects**: Ball, trail, particles (drawn on main canvas)

### Key Implementation Details

**Fog Recovery System**:
- Only runs when `gameStarted = true` (prevents pre-game fog buildup)
- Recovery rate: `REFOG_ALPHA = 3` (very slow, prevents overwriting lines)
- Interval: Every `REFOG_INTERVAL` frames

**Preview System**:
- Draws directly on `fogLayer` with temporary `erase()` mode
- Uses 70% of final transparency (`LINE_ERASE_ALPHA * 0.7`)
- Automatically overwritten when drawing completes

**Line Specifications**:
- Mobile: 46px width, PC: 47px width
- Taper: 40px sections at both ends (70%→100%→70% width)
- Transparency: `LINE_ERASE_ALPHA = 200` (removes 80% of fog)

## Audio System
- 32-voice synth pool with 5-second note duration
- Global reverb: 8s decay, 100% wet for lines, 0% for drones
- Device-specific optimizations for mobile performance

## Critical Bug Fixes Applied
1. **Preview Invisibility**: Fixed by drawing preview directly on fog layer instead of separate layer
2. **Background Aspect Ratio**: Fixed by preserving aspect ratio in preview layer
3. **Fog Recovery**: Prevented pre-game fog buildup with `gameStarted` condition
4. **Performance**: Reduced console.log calls to prevent audio glitches

## Device-Specific Settings
**Mobile**:
- Pixel density: 1 (performance)
- Frame rate: 30fps
- Fog alpha: 200
- Line width: 46px
- Particle size: 2-5px

**PC**:
- Pixel density: native
- Frame rate: 45fps  
- Fog alpha: 210
- Line width: 47px
- Particle size: 8-20px

## Development Notes
- Always test preview functionality when modifying layer systems
- Remember: transparency effects must be applied to the layer that will be visible
- Fog layer serves dual purpose: visual effect + collision detection surface 