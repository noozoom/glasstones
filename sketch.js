// GlassTones sketch.js 

// === 背景・曇りガラスエフェクト追加 (2025-06-18) ===
// 1) preload() で広告画像をロード
// 2) fogLayer (p5.Graphics) に白半透明レイヤーを保持し、erase() で透過
// 3) draw() 冒頭で広告を描画→ fogLayer で曇り → 以降ゲーム描画
// 4) Ball と Line 描画時に fogLayer をクリアして透過効果

let lines = []; // Array to store drawn lines
let points = []; // Array to store single-click points (hexagons)
let ball = {}; // Single ball object
let backgroundImg; // Background advertisement image
let backgroundAlpha = 0; // Control background alpha for smooth fade-in effect
let backgroundFadeStartTime = 0; // When fade-in started
let backgroundFading = false; // Whether fade-in is in progress
let fogLayer;      // Graphics layer for fog overlay
let draftLayer;    // Realtime preview layer (no fog interaction)
let gameStarted = false;

// === デバイス判定 & パラメータ自動調整 ===
const IS_MOBILE = /iP(hone|ad|od)|Android/.test(navigator.userAgent);

// Line properties
const MAX_LINES = 8;
const LINE_LIFETIME = 10000; // 10 seconds in milliseconds
const MAX_LINE_LENGTH = 200; // Maximum points per line

// Ball properties
const BALL_SIZE = IS_MOBILE ? 28 : 32; // Mobile: 少し小さめだが見やすいサイズ (32 → 28)
const BALL_SPEED = 1.5;
const COLLISION_RADIUS = BALL_SIZE / 2 + 12; // Keep same padding
const FPS              = IS_MOBILE ? 30 : 45; // Mobile: 30fps（24→30で滑らかに）
// 85% 不透明程度 (≈217)
const FOG_INITIAL_ALPHA = IS_MOBILE ? 220 : 232; // Mobile: 220（200→220で濃く）
// Adjust fog recovery constants for faster recovery (6 seconds to full opacity)
const REFOG_ALPHA       = IS_MOBILE ? 18 : 25; // Mobile: 18（12→18で適度に）
const REFOG_INTERVAL    = IS_MOBILE ? 3 : 2; // Mobile: 3フレーム間隔（4→3）

// Separate recovery for lines (slower than ripples)
const LINE_REFOG_ALPHA  = IS_MOBILE ? 6 : 8; // Mobile: 6（3→6で適度に）
const LINE_REFOG_INTERVAL = IS_MOBILE ? 6 : 4; // Mobile: 6フレーム間隔（8→6）

// Line visual sizes
const LINE_MAIN_WEIGHT  = IS_MOBILE ? 22 : 23.5; // Mobile: 22（20→22で太く）
const LINE_GLOW_WEIGHT  = IS_MOBILE ? 30 : (LINE_MAIN_WEIGHT * 1.5); // Mobile: 30（28→30）

// Point properties (hexagon points) - defined after LINE_MAIN_WEIGHT
const MAX_POINTS = 12; // Maximum number of points
const POINT_LIFETIME = 15000; // 15 seconds in milliseconds
const POINT_RADIUS = LINE_MAIN_WEIGHT * 0.2875; // 半分のサイズ: 0.575 → 0.2875

// Current drawing line
let currentLine = null;
let isDrawing = false;

// Consecutive hit tracking for octave scaling
let lastHitLineIndex = -1;
let consecutiveHits = 0;
let lastHitTime = 0;

let lastNoteName = "";
let lastLineLen = 0;
let lastFreq = 0;
let lastInfoTime = 0;

// Pixel-density scaling (CSS px を基準にする)
let PD_SCALE = 1; // set in setup()

// Add after existing const declarations near the top
const DEBUG = false; // Set to true for development logging

// Add constant near other const declarations
const TRAIL_TAPER_INTENSITY = 0.3; // 0 (old) - 1 (full comet taper)

// Add new constant near fog clear const
const LINE_ERASE_ALPHA = 200; // 0=fully clear, 255=no clear; 200 means ~80% clear

// Add new constant near fog clear const
const FOG_CLEAR_MULT = 1.0; // use exact line width for clearing

// Add ripple effect system variables
let ripples = []; // Array to store collision ripples

// Ripple effect class for water-like expanding circles
class CollisionRipple {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.startTime = millis();
        this.life = 8000; // 8 seconds total life
        this.maxLife = 8000;
    }

    update() {
        const currentTime = millis();
        this.life = this.maxLife - (currentTime - this.startTime);
        return this.life > 0;
    }

    draw() {
        const currentTime = millis();
        const age = currentTime - this.startTime;
        
        // Calculate overall progress (0→1 over 8 seconds)
        const progress = age / this.maxLife;
        if (progress < 0 || progress > 1) return;
        
        // Calculate current ring radius
        const maxRadius = IS_MOBILE ? 250 : 300;
        const currentRadius = maxRadius * progress;
        
        // Ring thickness
        const ringThickness = IS_MOBILE ? 18 : 20;
        
        // Draw transparent ring by temporarily erasing fogLayer at ring position only
        fogLayer.push();
        fogLayer.erase(255, 255 * 0.9); // 90% transparency at ring position
        fogLayer.noFill();
        fogLayer.stroke(255);
        fogLayer.strokeWeight(ringThickness);
        fogLayer.ellipse(this.x, this.y, currentRadius * 2);
        fogLayer.noErase();
        fogLayer.pop();
    }
}

// Create collision ripples
function createCollisionRipples(x, y) {
    ripples.push(new CollisionRipple(x, y));
}

// Update ripples in draw()
function updateRipples() {
    for (let i = ripples.length - 1; i >= 0; i--) {
        if (!ripples[i].update()) {
            ripples.splice(i, 1);
        } else {
            ripples[i].draw();
        }
    }
}

// -----------------------------
// p5 preload : 広告画像を読み込み
// -----------------------------
function preload() {
    console.log('preload() called - p5.js is working');
    
    backgroundImg = loadImage('assets/rust_bg.jpg', () => {
        console.log('Rust background loaded successfully in p5.js');
        // Start fade-in after 1 second delay
        setTimeout(() => {
            console.log('Starting p5.js background smooth fade-in (2s duration)...');
            backgroundFading = true;
            backgroundFadeStartTime = millis();
        }, 1000); // 1秒後にフェードイン開始
    }, err => {
        console.error('Rust background load failed, loading fallback:', err);
        backgroundImg = loadImage('assets/027_01.jpg', () => {
            console.log('Fallback background loaded');
            setTimeout(() => {
                backgroundFading = true;
                backgroundFadeStartTime = millis();
            }, 1000);
        }, err2 => {
            console.error('Fallback background also failed:', err2);
        });
    });
}

function setup() {
    console.log('setup() called - p5.js setup is working');
    console.log('windowWidth:', windowWidth, 'windowHeight:', windowHeight);
    console.log('IS_MOBILE:', IS_MOBILE);
    
    // Mobile 向けはピクセル密度を 1 にして負荷を軽減
    if (IS_MOBILE) {
        pixelDensity(1);
        console.log('Mobile detected - pixelDensity set to 1');
    }
    // Create canvas that fills the window
    createCanvas(windowWidth, windowHeight);
    
    console.log('Canvas created:', windowWidth, 'x', windowHeight);
    console.log('Width/Height:', width, 'x', height);
    console.log('p5.js functions available:', typeof background, typeof ellipse, typeof rect);
    console.log('backgroundImg status:', backgroundImg ? 'loaded' : 'not loaded');
    
    // Create fog overlay
    fogLayer = createGraphics(windowWidth, windowHeight);
    fogLayer.noStroke();
    fogLayer.background(230, 230, 230, FOG_INITIAL_ALPHA); // 10% darker fog
    
    // Create draft layer (transparent)
    draftLayer = createGraphics(windowWidth, windowHeight);
    draftLayer.clear();
    
    // Initialize ball
    initializeBall();
    
    // Don't start the game automatically - wait for user to click START button
    // gameStarted will be set to true in startGame() function
    
    // Initialize score display
    if (typeof initializeScore === 'function') {
        initializeScore();
    }
    
    // Test note display
    setTimeout(() => {
        let noteEl = document.getElementById('note-display');
        if (noteEl) {
            noteEl.textContent = ''; // テキストをクリアして非表示にする
            noteEl.style.display = 'none';
            console.log('Note display element found and cleared');
        } else {
            console.error('Note display element not found');
        }
    }, 1000);
    
    console.log('Setup complete');
    
    frameRate(FPS); // Cap FPS for mobile performance
    
    // 取得した pixelDensity でスケールを決定
    PD_SCALE = 1 / pixelDensity();
}

function draw() {
    // Basic function check
    if (frameCount === 1) {
        console.log('draw() called - first frame');
        console.log('ball object:', ball);
        console.log('fogLayer:', fogLayer);
        console.log('backgroundImg:', backgroundImg);
    }
    if (frameCount % 300 === 0) { // Log every 5 seconds
        console.log('Game running, frame:', frameCount);
    }
    
    // ---------- 背景広告を描画（縦横比保持でカバー + スムーズフェードイン） ----------
    
    // Update background fade-in alpha
    if (backgroundFading) {
        const fadeInDuration = 2000; // 2 seconds fade-in
        const elapsed = millis() - backgroundFadeStartTime;
        backgroundAlpha = map(elapsed, 0, fadeInDuration, 0, 255);
        backgroundAlpha = constrain(backgroundAlpha, 0, 255);
        
        if (backgroundAlpha >= 255) {
            backgroundFading = false; // Fade-in complete
            console.log('Background fade-in completed');
        }
    }
    
    // Always draw dark background first
    background(26, 26, 26); // Same as CSS #1a1a1a
    
    // Draw background image with alpha if available
    if (backgroundImg && backgroundAlpha > 0) {
        // Calculate scale to cover entire screen while maintaining aspect ratio
        let scaleX = width / backgroundImg.width;
        let scaleY = height / backgroundImg.height;
        let scale = Math.max(scaleX, scaleY); // Use larger scale to cover
        
        let scaledWidth = backgroundImg.width * scale;
        let scaledHeight = backgroundImg.height * scale;
        
        // Center the image
        let offsetX = (width - scaledWidth) / 2;
        let offsetY = (height - scaledHeight) / 2;
        
        // Apply alpha for smooth fade-in
        tint(255, backgroundAlpha);
        image(backgroundImg, offsetX, offsetY, scaledWidth, scaledHeight);
        noTint(); // Reset tint for other elements
    }

    // ---------- フォグレイヤーの徐々に再曇り処理 ----------
    // 統一された霧回復（リップル用の早い回復速度）- スタート前でも動作
    if (frameCount % REFOG_INTERVAL === 0) {
        fogLayer.push();
        fogLayer.blendMode(BLEND);
        fogLayer.fill(230, 230, 230, REFOG_ALPHA);
        fogLayer.noStroke();
        fogLayer.rect(0, 0, width, height);
        fogLayer.pop();
    }

    // Update and draw all lines
    updateLines();
    drawLines();
    
    // Update & draw ball + trail (これらで fogLayer を消去する)
    updateBall();
    drawBallTrail(); // 先に trail で透過
    drawBall();

    // ---------- フォグレイヤーをキャンバスに重ねる ----------
    if (frameCount % 60 === 0) {
        console.log('Drawing fog layer, size:', fogLayer.width, 'x', fogLayer.height);
    }
    image(fogLayer, 0, 0);

    // --- realtime preview layer on top of fog ---
    
    // Draw preview line if currently drawing (but don't erase fog layer during preview)
    if (currentLine && currentLine.points.length > 1) {
        drawPreviewLineOnCanvas(currentLine);
    } else {
        // 描画していない時はプレビューレイヤーをクリア
        draftLayer.clear();
    }
    
    // Always draw draftLayer (even if empty)
    image(draftLayer, 0, 0);

    // Update ripples
    updateRipples();
}

function createBackgroundImage() {
    // Simplified - no longer needed
    console.log('Background function called but simplified');
}

function drawBackground() {
    // Simplified - just use background() in draw()
    background(150, 50, 150);
}

function initializeBall() {
    ball = {
        x: width / 2,
        y: height / 2,
        vx: random(-BALL_SPEED, BALL_SPEED),
        vy: random(-BALL_SPEED, BALL_SPEED),
        trail: [] // Array to store trail positions
    };
    
    // Ensure minimum speed
    if (Math.abs(ball.vx) < 0.5) ball.vx = ball.vx < 0 ? -0.5 : 0.5;
    if (Math.abs(ball.vy) < 0.5) ball.vy = ball.vy < 0 ? -0.5 : 0.5;
}

function updateBall() {
    // Store previous position before moving
    let prevX = ball.x;
    let prevY = ball.y;
    
    // Store current position for trail
    ball.trail.push({x: ball.x, y: ball.y});
    
    // Limit trail length (10 seconds at 60fps = 600 frames)
    if (ball.trail.length > 600) {
        ball.trail.shift();
    }
    
    // Move ball
    ball.x += ball.vx;
    ball.y += ball.vy;
    
    // Bounce off walls
    if (ball.x - BALL_SIZE/2 <= 0 || ball.x + BALL_SIZE/2 >= width) {
        ball.vx *= -1;
        ball.x = Math.max(BALL_SIZE/2, Math.min(ball.x, width - BALL_SIZE/2));
        
        // Play random sound on wall collision
        playRandomWallSound(ball.x, ball.y);
    }
    if (ball.y - BALL_SIZE/2 <= 0 || ball.y + BALL_SIZE/2 >= height) {
        ball.vy *= -1;
        ball.y = Math.max(BALL_SIZE/2, Math.min(ball.y, height - BALL_SIZE/2));
        
        // Play random sound on wall collision
        playRandomWallSound(ball.x, ball.y);
    }
    
    // Check collision with lines (with tunneling prevention)
    checkLineCollisions(prevX, prevY);

    // Update A3 drone panning to follow ball
    if (typeof window.updateDronePanning === 'function') {
        window.updateDronePanning(ball.x);
    }
}

function drawBall() {
    // Draw ball with glow effect
    push();
    
    // 生きているような明るさの揺らぎ
    const breathe = sin(millis() * 0.003) * 0.3 + 0.7; // 0.4〜1.0
    const pulse = sin(millis() * 0.008) * 0.2 + 0.8;   // 0.6〜1.0
    const glow = breathe * pulse;
    
    // 多層グロー効果（この世界で最も明るい存在）
    const glowLayers = IS_MOBILE ? 6 : 8; // Mobile: fewer glow layers for performance
    const glowSpread = IS_MOBILE ? 4 : 6; // Mobile: smaller glow spread
    for (let i = glowLayers; i > 0; i--) {
        const alpha = map(i, 0, glowLayers, 255, 30) * glow;
        const size = BALL_SIZE + i * glowSpread;
        fill(255, 255, 255, alpha);
        noStroke();
        ellipse(ball.x, ball.y, size);
    }
    
    // コア（真っ白な発光体）
    fill(255, 255, 255, 255 * glow);
    noStroke();
    ellipse(ball.x, ball.y, BALL_SIZE);
    
    // 内部ハイライト
    fill(255, 255, 255, 200 * glow);
    ellipse(ball.x - BALL_SIZE*0.15, ball.y - BALL_SIZE*0.15, BALL_SIZE * 0.4);
    
    pop();

    // ---- fogLayer を適度に消去して発光効果を演出 ----
    fogLayer.erase();
    fogLayer.fill(255);
    const CLEAR_SCALE = IS_MOBILE ? PD_SCALE : 1;
    const clearPadding = IS_MOBILE ? 8 : 12; // Much smaller clear area to avoid interfering with trail
    const CLEAR_BALL_DIAM = (BALL_SIZE + clearPadding) * CLEAR_SCALE * glow; // ボール半径分の発光クリア
    fogLayer.ellipse(ball.x, ball.y, CLEAR_BALL_DIAM);
    fogLayer.noErase();
}

function drawBallTrail() {
    // Draw comet-like trail effect - ALWAYS active (not limited by gameStarted)
    push();
    
    const trailLength = ball.trail.length;
    const frameRate60 = 60; // Assume 60fps for time calculation
    const halfSizeTime = 2 * frameRate60; // 2 seconds to half size (120 frames)
    
    for (let i = 0; i < trailLength; i++) {
        let pos = ball.trail[i];
        let progress = i / (trailLength - 1); // 0(tail) to 1(head)
        let ageInFrames = trailLength - 1 - i; // Age of this trail point
        
        // Comet-like size reduction: rapid taper near head, long thin tail
        let size;
        if (ageInFrames <= halfSizeTime) {
            // First 2 seconds: rapid size reduction (exponential decay)
            const timeProgress = ageInFrames / halfSizeTime; // 0→1 over 2 seconds
            size = BALL_SIZE * Math.pow(0.5, timeProgress); // Exponential decay to half size
        } else {
            // After 2 seconds: very thin but long tail
            const baseSize = BALL_SIZE * 0.5; // Half size as base
            const extraTime = ageInFrames - halfSizeTime;
            const remainingFrames = trailLength - halfSizeTime;
            if (remainingFrames > 0) {
                const tailProgress = extraTime / remainingFrames; // 0→1 for remaining time
                size = baseSize * (1 - tailProgress * 0.8); // Reduce to 20% of half size
            } else {
                size = baseSize * 0.2;
            }
        }
        
        // Minimum size for visibility
        size = Math.max(size, 1);
        
        // Alpha fading: stronger near head, gradual fade
        let alpha;
        if (ageInFrames <= halfSizeTime) {
            alpha = map(ageInFrames, 0, halfSizeTime, 120, 60); // Strong to medium
        } else {
            const extraTime = ageInFrames - halfSizeTime;
            const remainingFrames = trailLength - halfSizeTime;
            if (remainingFrames > 0) {
                alpha = map(extraTime, 0, remainingFrames, 60, 10); // Medium to faint
            } else {
                alpha = 10;
            }
        }
        
        // Draw trail point with fog clearing - ALWAYS clear fog regardless of game state
        fogLayer.erase(255, alpha);
        fogLayer.fill(255);
        fogLayer.noStroke();
        fogLayer.ellipse(pos.x, pos.y, size);
        fogLayer.noErase();
    }
    
    pop();
}

function checkLineCollisions(prevX, prevY) {
    for (let i = 0; i < lines.length; i++) {
        let lineData = lines[i];
        
        if (lineData.points.length < 2) continue;
        
        // For straight line collision, use start and end points only
        let p1 = lineData.points[0];
        let p2 = lineData.points[lineData.points.length - 1];
        
        // First check: current position distance
        let distance = distanceToLineSegment(ball.x, ball.y, p1.x, p1.y, p2.x, p2.y);
        
        // Second check: did the ball cross or come close between frames?
        let crossed = false;
        let pathDistance = Infinity;
        if (prevX !== undefined && prevY !== undefined) {
            crossed = lineSegmentsIntersect(prevX, prevY, ball.x, ball.y, p1.x, p1.y, p2.x, p2.y);
            // 追加: 移動線分と線分間の最短距離を計算
            pathDistance = distanceBetweenLineSegments(prevX, prevY, ball.x, ball.y, p1.x, p1.y, p2.x, p2.y);
        }
        
                if (distance <= COLLISION_RADIUS || crossed || pathDistance <= COLLISION_RADIUS) {
            // Collision detected!
            console.log('Collision detected with line', i);
            
            // Check if enough time has passed since last hit (200ms minimum)
            const currentTime = millis();
            const timeSinceLastHit = currentTime - lastHitTime;
            
            let volumeMultiplier = 1.0;
            if (timeSinceLastHit < 200) {  // If collision occurs within 200ms (より短く)
                console.log('Hit too soon, reducing volume (', timeSinceLastHit, 'ms since last hit)');
                volumeMultiplier = 0.8;  // Reduce volume by 20% (より軽く)
            }
            
            // Update hit timing
            lastHitTime = currentTime;
            
            // Check if this is the same line as last hit
            if (lastHitLineIndex === i) {
                consecutiveHits++;
            } else {
                consecutiveHits = 1; // Reset for new line
                lastHitLineIndex = i;
            }
            
            console.log('Consecutive hits on line', i, ':', consecutiveHits);
            
            // Play sound with simple audio system (only if game has started)
            if (gameStarted) {
                if (typeof window.playSimpleSound === 'function') {
                    const lineLength = calculateLineLengthFromPoints(lineData.points);
                    const currentTime = millis();
                    const lineAge = currentTime - lineData.startTime;
                    console.log('Playing simple sound for line', i, 'length:', lineLength, 'ball:', ball.x, ball.y, 'consecutiveHits:', consecutiveHits);
                    window.playSimpleSound(lineLength, ball.x, ball.y, consecutiveHits, volumeMultiplier, lineAge);
                } else if (typeof playLineSound === 'function') {
                    console.log('Calling playLineSound for line', i, 'with', lineData.points.length, 'points');
                    playLineSound(lineData, consecutiveHits, ball.x, volumeMultiplier);  // Pass volumeMultiplier
                } else {
                    console.error('No sound function available');
                }
            }
            
            // Create collision ripples
            createCollisionRipples(ball.x, ball.y);
            
            // Add score (more points for consecutive hits)
            if (typeof addScore === 'function') {
                addScore(lineData, 10 * consecutiveHits);
            }
            
            // Reflect ball off the line
            reflectBallOffLine(p1, p2, crossed, prevX, prevY);
            
            return; // Only handle one collision per frame
        }
    }
    
    // Check collisions with hexagon points
    checkHexagonCollisions(prevX, prevY);
}

function checkHexagonCollisions(prevX, prevY) {
    for (let i = 0; i < points.length; i++) {
        let pointData = points[i];
        
        // Check collision with each edge of the hexagon
        for (let j = 0; j < pointData.vertices.length; j++) {
            let p1 = pointData.vertices[j];
            let p2 = pointData.vertices[(j + 1) % pointData.vertices.length]; // Next vertex (wrap around)
            
            // Check distance to this edge
            let distance = distanceToLineSegment(ball.x, ball.y, p1.x, p1.y, p2.x, p2.y);
            
            // Check if ball crossed this edge
            let crossed = false;
            let pathDistance = Infinity;
            if (prevX !== undefined && prevY !== undefined) {
                crossed = lineSegmentsIntersect(prevX, prevY, ball.x, ball.y, p1.x, p1.y, p2.x, p2.y);
                pathDistance = distanceBetweenLineSegments(prevX, prevY, ball.x, ball.y, p1.x, p1.y, p2.x, p2.y);
            }
            
            if (distance <= COLLISION_RADIUS || crossed || pathDistance <= COLLISION_RADIUS) {
                console.log('Collision detected with hexagon point', i, 'edge', j);
                
                // Check if enough time has passed since last hit
                const currentTime = millis();
                const timeSinceLastHit = currentTime - lastHitTime;
                
                let volumeMultiplier = 1.0;
                if (timeSinceLastHit < 200) {  // If collision occurs within 200ms (より短く)
                    console.log('Hit too soon, reducing volume (', timeSinceLastHit, 'ms since last hit)');
                    volumeMultiplier = 0.8;  // Reduce volume by 20% (より軽く)
                }
                
                lastHitTime = currentTime;
                consecutiveHits = 1; // Reset consecutive hits for points
                lastHitLineIndex = -1; // Reset line tracking
                
                // Play point sound (high notes D6, C6, A5) - only if game has started
                if (gameStarted && typeof window.playPointSound === 'function') {
                    window.playPointSound(ball.x, ball.y, volumeMultiplier);
                }
                
                // Create collision ripples for hexagon hit
                createCollisionRipples(ball.x, ball.y);
                
                // Add score for hitting point
                if (typeof addScore === 'function') {
                    addScore(pointData, 15 * volumeMultiplier); // Higher score for hitting points
                }
                
                // Reflect ball off the hexagon edge
                reflectBallOffLine(p1, p2, crossed, prevX, prevY);
                
                return; // Only handle one collision per frame
            }
        }
    }
}

function calculateLineLengthFromPoints(points) {
    if (points.length < 2) return 0;
    
    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
        let dx = points[i].x - points[i-1].x;
        let dy = points[i].y - points[i-1].y;
        totalLength += Math.sqrt(dx * dx + dy * dy);
    }
    
    return totalLength;
}

function distanceToLineSegment(px, py, x1, y1, x2, y2) {
    // Calculate distance from point (px, py) to line segment (x1,y1)-(x2,y2)
    let A = px - x1;
    let B = py - y1;
    let C = x2 - x1;
    let D = y2 - y1;
    
    let dot = A * C + B * D;
    let lenSq = C * C + D * D;
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B); // Point to point distance
    
    let param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    
    let dx = px - xx;
    let dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

function lineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    // Check if line segment (x1,y1)-(x2,y2) intersects with (x3,y3)-(x4,y4)
    let denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.0001) return false; // Lines are parallel
    
    let t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    let u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    return (t >= 0 && t <= 1 && u >= 0 && u <= 1);
}

function generateSmoothCollisionCurve(originalPoints) {
    if (originalPoints.length < 3) return originalPoints;
    
    let smoothPoints = [];
    
    // Use a simple smoothing algorithm: average neighboring points
    // First point stays the same
    smoothPoints.push(originalPoints[0]);
    
    // Smooth middle points using weighted average
    for (let i = 1; i < originalPoints.length - 1; i++) {
        let prev = originalPoints[i - 1];
        let curr = originalPoints[i];
        let next = originalPoints[i + 1];
        
        // Weighted average: 25% previous + 50% current + 25% next
        let smoothX = prev.x * 0.25 + curr.x * 0.5 + next.x * 0.25;
        let smoothY = prev.y * 0.25 + curr.y * 0.5 + next.y * 0.25;
        
        smoothPoints.push({x: smoothX, y: smoothY});
    }
    
    // Last point stays the same
    smoothPoints.push(originalPoints[originalPoints.length - 1]);
    
    // Apply smoothing multiple times for better results (more passes)
    for (let pass = 0; pass < 3; pass++) {
        let tempPoints = [smoothPoints[0]]; // Keep first point
        
        for (let i = 1; i < smoothPoints.length - 1; i++) {
            let prev = smoothPoints[i - 1];
            let curr = smoothPoints[i];
            let next = smoothPoints[i + 1];
            
            let smoothX = prev.x * 0.2 + curr.x * 0.6 + next.x * 0.2;
            let smoothY = prev.y * 0.2 + curr.y * 0.6 + next.y * 0.2;
            
            tempPoints.push({x: smoothX, y: smoothY});
        }
        
        tempPoints.push(smoothPoints[smoothPoints.length - 1]); // Keep last point
        smoothPoints = tempPoints;
    }
    
    return smoothPoints;
}

// Add debug logging to track ball position and collision (removed - causing error)

// Refine collision handling
function reflectBallOffLine(p1, p2, crossed, prevX, prevY) {
    // Calculate line direction and normal (unit vectors)
    let lineVx = p2.x - p1.x;
    let lineVy = p2.y - p1.y;
    let lineLength = Math.sqrt(lineVx * lineVx + lineVy * lineVy);
    if (lineLength === 0) return;
    lineVx /= lineLength;
    lineVy /= lineLength;
    let normalX = -lineVy;
    let normalY = lineVx;

    // If we crossed the line, approximate intersection at midpoint between previous and current position
    if (crossed && prevX !== undefined && prevY !== undefined) {
        ball.x = (prevX + ball.x) * 0.5;
        ball.y = (prevY + ball.y) * 0.5;
    }

    // Determine correct normal orientation (pointing away from the line towards the ball)
    let side = (ball.x - p1.x) * normalX + (ball.y - p1.y) * normalY; // signed distance along normal
    if (side < 0) {
        // Flip normal to point outwards
        normalX *= -1;
        normalY *= -1;
        side *= -1;
    }

    // Move ball exactly outside the collision radius
    let distanceToLine = distanceToLineSegment(ball.x, ball.y, p1.x, p1.y, p2.x, p2.y);
    let penetration = COLLISION_RADIUS - distanceToLine;
    if (penetration > 0) {
        ball.x += normalX * (penetration + 0.1); // small epsilon
        ball.y += normalY * (penetration + 0.1);
    }

    // Reflect velocity
    let dotProduct = ball.vx * normalX + ball.vy * normalY;
    ball.vx = ball.vx - 2 * dotProduct * normalX;
    ball.vy = ball.vy - 2 * dotProduct * normalY;

    // Small damping to avoid endless vibration
    ball.vx *= 0.995;
    ball.vy *= 0.995;

    // Ensure minimum speed
    let speed = Math.hypot(ball.vx, ball.vy);
    if (speed < BALL_SPEED * 0.8) {
        ball.vx = (ball.vx / speed) * BALL_SPEED;
        ball.vy = (ball.vy / speed) * BALL_SPEED;
    }
}

// Drawing functions
function mousePressed() {
    // Don't start drawing if game hasn't started yet
    if (!gameStarted) {
        return;
    }
    
    // Initialize audio on first click
    handleUserInteraction();
    startDrawing(mouseX, mouseY);
}

function mouseDragged() {
    if (isDrawing) {
        addPointToCurrentLine(mouseX, mouseY);
    }
}

function mouseReleased() {
    endDrawing();
}

// Touch events for mobile
function touchStarted() {
    // Don't start drawing if game hasn't started yet
    if (!gameStarted) {
        return false;
    }
    
    // Initialize audio on first touch
    handleUserInteraction();
    if (touches.length > 0) {
        startDrawing(touches[0].x, touches[0].y);
    }
    return false; // Prevent default
}

function touchMoved() {
    if (isDrawing && touches.length > 0) {
        addPointToCurrentLine(touches[0].x, touches[0].y);
    }
    return false; // Prevent default
}

function touchEnded() {
    endDrawing();
    return false; // Prevent default
}

function startDrawing(x, y) {
    console.log('startDrawing called at:', x, y);
    isDrawing = true;
    currentLine = {
        points: [{x: x, y: y}],
        startTime: millis(),
        id: random(1000000) // Unique ID for scoring
    };
}

function addPointToCurrentLine(x, y) {
    if (!currentLine) return;
    
    let lastPoint = currentLine.points[currentLine.points.length - 1];
    let distance = dist(x, y, lastPoint.x, lastPoint.y);
    
    // Only add point if it's far enough from the last point
    if (distance > 3) {
        currentLine.points.push({x: x, y: y});
        
        // Limit line length
        if (currentLine.points.length > MAX_LINE_LENGTH) {
            currentLine.points.shift();
        }
    }
}

function endDrawing() {
    console.log('endDrawing called, points:', currentLine ? currentLine.points.length : 'no currentLine');
    if (!isDrawing || !currentLine) return;
    
    isDrawing = false;
    
    // Check if it's a single click/tap (create point) or a line drag
    if (currentLine.points.length <= 2) {
        // Single click/tap - create a hexagon point
        createHexagonPoint(currentLine.points[0].x, currentLine.points[0].y);
    } else if (currentLine.points.length > 5) {
        // Line drag - create a line as before
        currentLine.collisionCurve = generateSmoothCollisionCurve(currentLine.points);
        
        lines.push({ 
            points: currentLine.points, 
            startTime: currentLine.startTime, 
            collisionCurve: currentLine.collisionCurve, 
            clearDone: false 
        });
        console.log('Line added to lines array, total lines:', lines.length);
        
        // Initialize audio context when user first draws
        if (typeof initializeAudio === 'function') {
            initializeAudio();
        }
    }
    
    currentLine = null;
}

function createHexagonPoint(x, y) {
    // Create a hexagon point with 6 vertices
    let hexagon = [];
    for (let i = 0; i < 6; i++) {
        let angle = (i * PI) / 3; // 60 degrees apart
        let px = x + cos(angle) * POINT_RADIUS;
        let py = y + sin(angle) * POINT_RADIUS;
        hexagon.push({x: px, y: py});
    }
    
    let point = {
        center: {x: x, y: y},
        vertices: hexagon,
        startTime: millis(),
        id: random(1000000)
    };
    
    points.push(point);
    
    // Remove oldest point if we have too many
    if (points.length > MAX_POINTS) {
        points.shift();
    }
    
    console.log('Created hexagon point at', x.toFixed(1), y.toFixed(1));
}

function updateLines() {
    let currentTime = millis();
    
    // Remove expired lines
    lines = lines.filter(lineData => {
        return currentTime - lineData.startTime < LINE_LIFETIME;
    });
    
    // Remove expired points
    points = points.filter(pointData => {
        return currentTime - pointData.startTime < POINT_LIFETIME;
    });
}

function drawLines() {
    push();

    // Draw all completed lines (perform one-time fog clear)
    for (let lineData of lines) {
        drawLine(lineData); // erase handled inside once
    }

    // Draw all hexagon points
    for (let pointData of points) {
        drawHexagonPoint(pointData);
    }

    pop();
}

function drawLine(lineData, doErase = true) {
    if (lineData.points.length < 2) return;
    
    // Calculate line age and fade
    const currentTime = millis();
    const age = currentTime - lineData.startTime;
    const fadeProgress = age / LINE_LIFETIME; // 0→1 over 10 seconds
    
    // Draw a straight line from start to end
    let p1 = lineData.points[0];
    let p2 = lineData.points[lineData.points.length - 1];
    
    // One-time fog clearing when line is first drawn
    const needClear = doErase && !lineData.clearDone;
    if (needClear) {
        fogLayer.erase(255, LINE_ERASE_ALPHA);
        try {
            fogLayer.stroke(255);
            fogLayer.strokeWeight(LINE_MAIN_WEIGHT * FOG_CLEAR_MULT * PD_SCALE);
            fogLayer.line(p1.x, p1.y, p2.x, p2.y);
        } finally {
            fogLayer.noErase();
        }
        lineData.clearDone = true;
    }
    
    // Draw visible line that fades out over time (on canvas, not fogLayer)
    if (fadeProgress < 1) {
        push();
        const alpha = map(fadeProgress, 0, 1, 150, 0); // Fade from 150 to 0
        
        // グロー効果（モバイルは軽量版）
        if (IS_MOBILE) {
            // モバイル: 軽量グロー効果
            stroke(255, 255, 255, alpha * 0.2);
            strokeWeight(LINE_GLOW_WEIGHT);
            line(p1.x, p1.y, p2.x, p2.y);
        } else {
            // デスクトップ: フルグロー効果
            stroke(255, 255, 255, alpha * 0.3);
            strokeWeight(LINE_GLOW_WEIGHT);
            line(p1.x, p1.y, p2.x, p2.y);
        }
        
        // メイン線（全デバイス共通）
        stroke(255, 255, 255, alpha);
        strokeWeight(LINE_MAIN_WEIGHT * 0.8);
        noFill();
        line(p1.x, p1.y, p2.x, p2.y);
        pop();
    }
}

function drawHexagonPoint(pointData) {
    const currentTime = millis();
    const age = currentTime - pointData.startTime;
    const fadeProgress = age / POINT_LIFETIME; // 0→1 over 15 seconds
    
    const x = pointData.center.x;
    const y = pointData.center.y;
    const radius = POINT_RADIUS;
    
    // One-time fog clearing when point is first drawn (same as lines)
    const needClear = !pointData.clearDone;
    if (needClear) {
        fogLayer.erase(255, LINE_ERASE_ALPHA);
        try {
                         fogLayer.stroke(255);
             fogLayer.strokeWeight(LINE_MAIN_WEIGHT * FOG_CLEAR_MULT * PD_SCALE);
             fogLayer.noFill();
             fogLayer.ellipse(x, y, radius); // 半分のサイズ: radius * 2 → radius
        } finally {
            fogLayer.noErase();
        }
        pointData.clearDone = true;
    }
    
    // Draw visible point that fades out over time (on canvas, same as lines)
    if (fadeProgress < 1) {
        push();
        const alpha = map(fadeProgress, 0, 1, 150, 0); // Fade from 150 to 0 (same as lines)
        
         // グロー効果（モバイルは軽量版、線と同じ）
         if (IS_MOBILE) {
             // モバイル: 軽量グロー効果
             stroke(255, 255, 255, alpha * 0.2);
             strokeWeight(LINE_GLOW_WEIGHT);
             noFill();
             ellipse(x, y, radius); // 半分のサイズ: radius * 2 → radius
         } else {
             // デスクトップ: フルグロー効果
             stroke(255, 255, 255, alpha * 0.3);
             strokeWeight(LINE_GLOW_WEIGHT);
             noFill();
             ellipse(x, y, radius); // 半分のサイズ: radius * 2 → radius
         }
         
         // メイン円（全デバイス共通、線と同じ設定）
         stroke(255, 255, 255, alpha);
         strokeWeight(LINE_MAIN_WEIGHT * 0.8); // Same as lines
         noFill();
         ellipse(x, y, radius); // 半分のサイズ: radius * 2 → radius
        pop();
    }
}

function handleUserInteraction() {
    // Initialize audio context when user first interacts
    if (typeof initializeAudio === 'function') {
        initializeAudio();
    }
}

// Handle window resize
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    // 再生成: fogLayer サイズ調整
    fogLayer = createGraphics(windowWidth, windowHeight);
    fogLayer.noStroke();
    fogLayer.background(230, 230, 230, FOG_INITIAL_ALPHA); // 10% darker fog

    draftLayer = createGraphics(windowWidth, windowHeight);
    draftLayer.clear();
}

// 追加: 2つの線分間の最短距離を計算
// Play random sound when ball hits wall
function playRandomWallSound(ballX, ballY) {
    // Only play sound if game has started
    if (!gameStarted) {
        return;
    }
    
    if (typeof window.playSimpleSound === 'function') {
        // 高音の確率を30%減らすために、線の長さ分布を調整
        // 通常: 10-30%の範囲で均等分布
        // 調整後: 高音域（短い線）の確率を30%減らし、中低音域を増やす
        
        const minLength = Math.hypot(width, height) * 0.1;  // 最短（高音）
        const maxLength = Math.hypot(width, height) * 0.3;  // 最長（低音）
        const midLength = (minLength + maxLength) / 2;       // 中間点
        
        let randomLength;
        const roll = Math.random();
        
        if (roll < 0.3) {
            // 30%の確率で高音域（短い線: minLength〜midLength）
            // 元々は50%だったので、30%減少
            randomLength = minLength + Math.random() * (midLength - minLength);
        } else {
            // 70%の確率で中低音域（長い線: midLength〜maxLength）
            // 元々は50%だったので、20%増加
            randomLength = midLength + Math.random() * (maxLength - midLength);
        }
        
        // 壁衝突音は音量を65%に設定
        const wallVolumeMultiplier = 0.65;
        
        console.log('Wall collision - playing sound with adjusted length:', randomLength.toFixed(1), 'volume:', wallVolumeMultiplier);
        window.playSimpleSound(randomLength, ballX, ballY, 1, wallVolumeMultiplier, 0);
    }
}

function distanceBetweenLineSegments(x1, y1, x2, y2, x3, y3, x4, y4) {
    // エンドポイントと相手線分との距離の最小値を近似的に使用
    let d1 = distanceToLineSegment(x1, y1, x3, y3, x4, y4);
    let d2 = distanceToLineSegment(x2, y2, x3, y3, x4, y4);
    let d3 = distanceToLineSegment(x3, y3, x1, y1, x2, y2);
    let d4 = distanceToLineSegment(x4, y4, x1, y1, x2, y2);
    return Math.min(d1, d2, d3, d4);
}

// Expose to sound.js
if (typeof window !== 'undefined') {
    window.updateHitInfo = function(note, len, freq) {
        lastNoteName = note;
        lastLineLen = len;
        lastFreq = freq;
        lastInfoTime = millis();

        // Note display disabled for clean user interface
        // console.log('HitInfo updated', note, len.toFixed(1), freq.toFixed(1));
    }
    
    // LUFS info display function (disabled for clean UI)
    window.updateLUFSInfo = function(info) {
        // Display disabled for clean user interface
        // console.log(`LUFS: ${info.currentLUFS.toFixed(1)}dB | Active: ${info.activeSounds} | Drones: ${info.dronesActive}`);
    }
}

function fadeOutStartMessage() {
    const startMessage = document.getElementById('start-message');
    if (startMessage) {
        startMessage.style.transition = 'opacity 2s ease-out';
        startMessage.style.opacity = '0';
        setTimeout(() => {
            startMessage.style.display = 'none';
        }, 2000);
    }
}

// Call this function when the game starts
function startGame() {
    fadeOutStartMessage();
    gameStarted = true; // Enable drawing after start button is clicked
    
    // Initialize audio system with user interaction, then activate volume
    if (typeof window.initSimpleAudio === 'function') {
        window.initSimpleAudio();
        console.log('Audio system initialized with user interaction');
        
        // Activate master volume after initialization
        setTimeout(() => {
            if (typeof window.activateMasterVolume === 'function') {
                window.activateMasterVolume();
                console.log('Master volume activated for game start');
            }
        }, 100); // 100ms delay for initialization
    }
    
    // Ensure no point is created on game start
    if (isDrawing) {
        endDrawing(); // End any drawing that might have started
    }
}

// Function to draw current line on preview layer without affecting fog
function drawPreviewLine(lineData) {
    if (lineData.points.length < 2) return;

    // モバイル軽量化: 簡単なプレビューのみ
    if (IS_MOBILE) {
        return drawPreviewLineOnCanvas(lineData);
    }

    // デスクトップ: フル機能プレビュー
    // 一時的に背景をプレビューレイヤーにコピーして透明効果を表示
    draftLayer.clear(); // プレビュー開始時にクリア
    draftLayer.push();
    
    // 背景画像があれば描画
    if (backgroundImg) {
        // 縦横比を保持して背景画像を描画
        let imgAspect = backgroundImg.width / backgroundImg.height;
        let canvasAspect = width / height;
        
        let drawWidth, drawHeight, drawX, drawY;
        
        if (imgAspect > canvasAspect) {
            // 画像の方が横長：高さを基準に
            drawHeight = height;
            drawWidth = height * imgAspect;
            drawX = (width - drawWidth) / 2;
            drawY = 0;
        } else {
            // 画像の方が縦長：幅を基準に
            drawWidth = width;
            drawHeight = width / imgAspect;
            drawX = 0;
            drawY = (height - drawHeight) / 2;
        }
        
        draftLayer.image(backgroundImg, drawX, drawY, drawWidth, drawHeight);
    }
    
    // 現在の霧レイヤーをコピーしてプレビュー線で削る
    draftLayer.tint(255, 255);
    draftLayer.image(fogLayer, 0, 0);
    draftLayer.noTint();
    
    // プレビュー線を描画（透明効果）
    draftLayer.erase(255, LINE_ERASE_ALPHA);
    draftLayer.stroke(255);
    draftLayer.noFill();
    
    const TAPER_PX = 40;
    let totalLen = 0;
    for (let i = 1; i < lineData.points.length; i++) {
        totalLen += dist(lineData.points[i-1].x, lineData.points[i-1].y, lineData.points[i].x, lineData.points[i].y);
    }
    
    let accLen = 0;
    for (let i = 1; i < lineData.points.length; i++) {
        let p1 = lineData.points[i-1];
        let p2 = lineData.points[i];
        let segLen = dist(p1.x, p1.y, p2.x, p2.y);
        
        let midDist = accLen + segLen/2;
        let w;
        if (midDist < TAPER_PX) {
            w = map(midDist, 0, TAPER_PX, LINE_MAIN_WEIGHT * 0.7, LINE_MAIN_WEIGHT);
        } else if (midDist > totalLen - TAPER_PX) {
            w = map(midDist, totalLen - TAPER_PX, totalLen, LINE_MAIN_WEIGHT, LINE_MAIN_WEIGHT * 0.7);
        } else {
            w = LINE_MAIN_WEIGHT;
        }
        
        draftLayer.strokeWeight(w);
        draftLayer.line(p1.x, p1.y, p2.x, p2.y);
        
        accLen += segLen;
    }
    
    draftLayer.noErase();
    draftLayer.pop();
}

function drawPreviewLineOnCanvas(lineData) {
    if (lineData.points.length < 2) return;
    
    // Draw preview line directly on canvas without affecting fog layer
    push();
    
    // Draw a straight line from start to end
    let p1 = lineData.points[0];
    let p2 = lineData.points[lineData.points.length - 1];
    
    // Semi-transparent white line for preview
    stroke(255, 255, 255, 150); // 半透明の白線
    strokeWeight(LINE_MAIN_WEIGHT * 0.8); // 少し細めに
    noFill();
    line(p1.x, p1.y, p2.x, p2.y);
    
    pop();
}

function drawPreviewLineDirectly(lineData) {
    if (lineData.points.length < 2) return;
    
    // 霧レイヤーに直接一時的に透明効果を描画
    fogLayer.push();
    fogLayer.erase(255, LINE_ERASE_ALPHA * 0.7); // プレビューは少し薄めに
    
    // Draw a straight line from start to end
    let p1 = lineData.points[0];
    let p2 = lineData.points[lineData.points.length - 1];
    fogLayer.stroke(255);
    fogLayer.strokeWeight(LINE_MAIN_WEIGHT);
    fogLayer.line(p1.x, p1.y, p2.x, p2.y);
    
    fogLayer.noErase();
    fogLayer.pop();
} 