# Preview Layer Architecture - Critical Lessons Learned

## The Problem: Invisible Preview Lines

### Initial Incorrect Approach ❌

```javascript
// WRONG: Separate preview layer approach
function drawPreviewLine(lineData) {
    draftLayer.clear();
    draftLayer.image(fogLayer, 0, 0);  // Copy current fog state
    draftLayer.erase(255, LINE_ERASE_ALPHA);  // Draw transparent line
    draftLayer.stroke(255);
    draftLayer.line(p1.x, p1.y, p2.x, p2.y);
    draftLayer.noErase();
}

// In draw() function:
image(fogLayer, 0, 0);      // Draw fog layer
image(draftLayer, 0, 0);    // Draw preview layer on top
```

**Why this failed:**
1. Preview layer contains: Background + Fog + Transparent line
2. When rendered, the fog portion of preview layer creates double-fog effect
3. Transparent areas in preview are still covered by fog, making them invisible
4. User sees: Normal fog during drawing, sudden transparency when drawing completes

### The Correct Solution ✅

```javascript
// CORRECT: Direct fog layer modification
function drawPreviewLineDirectly(lineData) {
    fogLayer.push();
    fogLayer.erase(255, LINE_ERASE_ALPHA * 0.7);  // Temporary transparency
    fogLayer.stroke(255);
    fogLayer.line(p1.x, p1.y, p2.x, p2.y);
    fogLayer.noErase();
    fogLayer.pop();
}

// In draw() function:
// Preview is already applied to fogLayer before this point
image(fogLayer, 0, 0);  // Draw fog layer with preview transparency
```

**Why this works:**
1. Preview transparency is applied directly to the fog layer
2. No double-fog effect
3. Transparent areas are immediately visible
4. When drawing completes, final line overwrites preview seamlessly

## Key Architectural Principles

### 1. Layer Visibility Rule
**"Transparency effects must be applied to the layer that will be visible"**

- ❌ Don't create transparency in a hidden layer
- ✅ Apply transparency directly to the visible layer

### 2. Rendering Order Matters
```
Background Image
    ↓
Fog Layer (with preview transparency)
    ↓
Game Objects (ball, particles)
```

### 3. State Management
```javascript
// Preview state is temporary and overwritten
if (currentLine && currentLine.points.length > 1) {
    drawPreviewLineDirectly(currentLine);  // Temporary modification
}
// When drawing ends:
drawLine(completedLine);  // Permanent modification overwrites preview
```

## Implementation Details

### Preview Transparency Adjustment
```javascript
// Use 70% of final transparency for preview
fogLayer.erase(255, LINE_ERASE_ALPHA * 0.7);
```
**Reasoning**: Slightly less transparent than final result provides visual feedback that this is a preview.

### Background Aspect Ratio Preservation
```javascript
// In preview layer (when needed):
let imgAspect = backgroundImg.width / backgroundImg.height;
let canvasAspect = width / height;
// Calculate proper scaling and positioning...
```

### Performance Considerations
- Preview modifications are temporary (no permanent state changes)
- Use `push()/pop()` to isolate preview rendering state
- Avoid copying large graphics objects when possible

## Debugging Tips

### Common Issues:
1. **Preview not visible**: Check if transparency is applied to visible layer
2. **Double-fog effect**: Ensure fog isn't copied to preview layer
3. **Aspect ratio distortion**: Verify background image scaling in preview
4. **Performance issues**: Minimize graphics copying operations

### Debug Logging:
```javascript
console.log('Drawing preview, points:', currentLine.points.length);
console.log('Preview transparency applied to fogLayer');
```

## Lessons for Future Development

1. **Always consider layer visibility when implementing preview systems**
2. **Test preview functionality immediately after implementation**
3. **Document layer rendering order clearly**
4. **Use direct modification for real-time effects, not layer copying**
5. **Preserve original state with push()/pop() for temporary modifications**

## Related Files
- `sketch.js`: Main implementation
- `cursor/summary.md`: Project overview
- This document: Technical deep-dive

---
*Created: 2025-01-18*  
*Last Updated: 2025-01-18*  
*Status: Implemented and Working* 