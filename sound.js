// GlassTones sound.js 

const DEBUG_SOUND = (typeof DEBUG !== 'undefined') ? DEBUG : false;

let audioInitialized = false;
let drone = null;
let droneD3 = null; // Second drone (D3)
let dronePanner = null;
let droneD3Panner = null;
let synthPool = [];
const SYNTH_POOL_SIZE = 32;

// Track last time each base frequency was played
let lastFreqTimes = {};

// -----------------------------
//  最新のプレイアブルスケール：13音階（高音→低音順）+ A4追加
// -----------------------------
const playableScale = [
    1174.66, // D6 (最高音・短い線)
    1046.50, // C6
    880.00,  // A5
    440.00,  // A4 (追加・スタート音)
    392.00,  // G4
    329.63,  // E4
    293.66,  // D4
    246.94,  // B3
    196.00,  // G3
    164.81,  // E3
    130.81,  // C3
    110.00,  // A2
    73.42    // D2 (最低音・長い線)
];

const playableNoteNames = [
    "D6", "C6", "A5", "A4", "G4", "E4", "D4", "B3", "G3", "E3", "C3", "A2", "D2"
];

// Backward compatibility aliases（既存コードのため）
const betaModeScale = playableScale;
const betaModeNoteNames = playableNoteNames;
const lydianScale = playableScale;
const lydianNoteNames = playableNoteNames;
const phrygianScale = playableScale;
const phrygianNoteNames = playableNoteNames;
const mixolydianScale = playableScale;
const mixolydianNoteNames = playableNoteNames;

// Add below Tone.js globals
let reverbNode = null;
let chorusNode = null;

// Initialize audio system
function initializeAudio() {
    if (audioInitialized) return;
    
    try {
        // Start Tone.js context
        Tone.start().then(() => {
            console.log('Audio context started');
            
            // Wait a bit more for full initialization
            setTimeout(() => {
                try {
                    // Create chorus effect (3-second slow modulation)
                    chorusNode = new Tone.Chorus({
                        frequency: 0.33, // 3-second period (1/3 Hz)
                        delayTime: 3.5,  // 3.5ms delay for gentle effect
                        depth: 0.7,      // 70% depth for noticeable but gentle modulation
                        spread: 180      // Full stereo spread
                    }).start();
                    
                    // Create global reverb (15s decay, 100% wet)
                    reverbNode = new Tone.Reverb({decay: 15, preDelay: 0.01}).toDestination();
                    reverbNode.wet.value = 1; // 100% reverb on routed signals
                    
                    // Chain: Chorus -> Reverb -> Destination
                    chorusNode.connect(reverbNode);
                    
                    // generate impulse asynchronously
                    if (typeof reverbNode.generate === 'function') {
                        reverbNode.generate().then(() => {
                            if (DEBUG_SOUND) console.log('Reverb generated');
                        });
                    }

                    setupDrone();
                    setupSynthPool();
                    audioInitialized = true;
                    console.log('Audio fully initialized');
                } catch (setupError) {
                    console.error('Failed to setup audio components:', setupError);
                }
            }, 100); // Wait 100ms after context start
        }).catch(error => {
            console.error('Failed to start Tone.js context:', error);
        });
    } catch (error) {
        console.error('Failed to initialize audio:', error);
    }
}

// Setup the drone bass with very slow 20-second attack
function setupDrone() {
    // Detect mobile devices for extra audio safety
    const isMobile = /iP(hone|ad|od)|Android/.test(navigator.userAgent);
    const fadeTime = isMobile ? 20 : 20; // Very slow 20-second fade on both platforms
    
    // ---------- D3 Drone ---------- (メインドローン - ルート音のD)
    droneD3Panner = new Tone.Panner(0).toDestination();
    const droneD3Gain = new Tone.Gain(0).connect(droneD3Panner);
    droneD3 = new Tone.Oscillator({
        frequency: 146.83, // D3 - メインドローン（ルート音）
        type: "sine",
        volume: -11 // Base volume 400%相当（-23 + 12dB = -11dB）
    }).connect(droneD3Gain);
    
    // Mobile-safe D3 drone start with very slow 20-second fade-in
    if (isMobile) {
        // Extra delay before starting on mobile
        setTimeout(() => {
            droneD3.start();
            // Start completely silent, then fade in over 20 seconds
            droneD3Gain.gain.value = 0;
            droneD3Gain.gain.exponentialRampTo(0.0001, 1); // Very quiet first, extended ramp
            droneD3Gain.gain.exponentialRampTo(1.348, fadeTime); // 400%相当: 0.337 × 4.0 = 1.348
        }, 200); // 200ms delay on mobile
    } else {
        droneD3.start();
        // Start completely silent, then fade in over 20 seconds on desktop
        droneD3Gain.gain.value = 0;
        droneD3Gain.gain.exponentialRampTo(0.001, 1);
        droneD3Gain.gain.exponentialRampTo(1.348, fadeTime); // 400%相当: 0.337 × 4.0 = 1.348
    }
    droneD3.gainNode = droneD3Gain;

    // ---------- A3 Drone ---------- (サブドローン - 5度上のA)
    dronePanner = new Tone.Panner(0).toDestination();
    const droneGain = new Tone.Gain(0).connect(dronePanner);
    drone = new Tone.Oscillator({
        frequency: 220.00, // A3 (220.00Hz) - サブドローン（5度上）
        type: "sine",
        volume: -11 // Base volume 400%相当（-23 + 12dB = -11dB）
    }).connect(droneGain);
    
    // Mobile-safe A3 drone start with very slow 20-second fade-in
    if (isMobile) {
        // Extra delay before starting on mobile
        setTimeout(() => {
            drone.start();
            // Start completely silent, then fade in over 20 seconds
            droneGain.gain.value = 0;
            droneGain.gain.exponentialRampTo(0.0001, 1); // Very quiet first, extended ramp
            droneGain.gain.exponentialRampTo(1.348, fadeTime); // 400%相当: 0.337 × 4.0 = 1.348
        }, 400); // Slightly more staggered from first drone
    } else {
        drone.start();
        // Start completely silent, then fade in over 20 seconds on desktop
        droneGain.gain.value = 0;
        droneGain.gain.exponentialRampTo(0.001, 1);
        droneGain.gain.exponentialRampTo(1.348, fadeTime); // 400%相当: 0.337 × 4.0 = 1.348
    }
    drone.gainNode = droneGain;
}

// Setup synthesizer pool for line sounds
function setupSynthPool() {
    synthPool = [];
    
    for (let i = 0; i < SYNTH_POOL_SIZE; i++) {
        const synth = new Tone.Synth({
            oscillator: {
                type: "sine"
            },
            envelope: {
                attack: 0.25,
                decay: 0.15,
                sustain: 0.3,
                release: 7.0 // Extend release to 7 seconds (4 + 3)
            },
            volume: -3 // 400%相当（-15 + 12dB = -3dB）
        });
        // Each synth routed via its own panner
        const panner = new Tone.Panner(0);
        // Route through chorus -> reverb chain
        panner.connect(chorusNode);
        synth.connect(panner);
        
        synthPool.push({
            synth: synth,
            panner: panner,
            inUse: false,
            lastUsed: 0,
            baseFreq: null
        });
    }
}

// Get frequency based on line length
function getFrequencyFromLineLength(lineLength) {
    // 画面対角線の1/4を基準長とし、短い線ほど高音になるよう指数カーブでマッピング
    const maxLength = Math.hypot(width, height) * 0.25; // 約画面1/4 (半分に短縮)
    // タッチデバイスでは物理的制約を考慮（指で描ける距離は画面サイズに関係なく同程度）
    const IS_TOUCH_DEVICE = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
    const effectiveMax = IS_TOUCH_DEVICE ? maxLength * 1.0 : maxLength * 0.67; // タッチ: 1.0倍、PC: 0.67倍
    const normalized = Math.min(lineLength / effectiveMax, 1);   // 0〜1 (長いほど1)
    const inverted = 1 - normalized;                          // 短いほど1
    const curved = Math.pow(inverted, 0.6);                   // カーブをかけて短線強調

    // playableScale: B3(最高音) 〜 G3(最低音) の5音階
    let index = Math.round(curved * (playableScale.length - 1)); // 0〜len-1
    index = Math.max(0, Math.min(index, playableScale.length - 1));

    const freq = playableScale[index];
    const noteName = playableNoteNames[index];
    if (DEBUG_SOUND) console.log(`LineLen:${lineLength.toFixed(1)} px -> idx ${index} (${noteName}) -> ${freq.toFixed(2)} Hz`);
    // Inform sketch.js for on-screen display
    if (typeof window !== 'undefined' && typeof window.updateHitInfo === 'function') {
        window.updateHitInfo(noteName, lineLength, freq);
    }
    return freq;
}

// Calculate line length from points
function calculateLineLength(linePoints) {
    if (linePoints.length < 2) return 0;
    
    let totalLength = 0;
    for (let i = 1; i < linePoints.length; i++) {
        let dx = linePoints[i].x - linePoints[i-1].x;
        let dy = linePoints[i].y - linePoints[i-1].y;
        totalLength += Math.sqrt(dx * dx + dy * dy);
    }
    
    return totalLength;
}

// Play sound when ball hits line
function playLineSound(line, consecutiveHits = 1, xPos = null) {
    // Always calculate and display note info, even if audio is not ready
    const lineLength = calculateLineLength(line.points);
    const frequencyForDisplay = getFrequencyFromLineLength(lineLength);
    
    if (!audioInitialized) {
        if (DEBUG_SOUND) console.log('Audio not initialized yet, initializing now...');
        // Try to initialize audio on first sound request
        initializeAudio();
        return; // Skip actual sound but display was already updated
    }
    
    // Additional safety check for Tone.js context
    if (Tone.context.state !== 'running') {
        if (DEBUG_SOUND) console.log('Tone.js context not running, skipping sound');
        return;
    }

    // Find available synth
    let availableSynth = null;
    let oldestTime = Infinity;
    let oldestIndex = 0;
    
    for (let i = 0; i < synthPool.length; i++) {
        if (!synthPool[i].inUse) {
            availableSynth = synthPool[i];
            break;
        } else if (synthPool[i].lastUsed < oldestTime) {
            oldestTime = synthPool[i].lastUsed;
            oldestIndex = i;
        }
    }
    
    // If no available synth, use the oldest one
    if (!availableSynth) {
        availableSynth = synthPool[oldestIndex];
        availableSynth.synth.triggerRelease(); // Stop current note
        availableSynth.baseFreq = null; // Clear previous base frequency
    }
    
    // Calculate frequency based on line length
    let frequency = frequencyForDisplay;
    
    // Detune logic: ±3 cents if same frequency is currently playing
    let needDetune = false;
    
    // Check if same base frequency is currently playing in any synth
    for (let i = 0; i < synthPool.length; i++) {
        if (synthPool[i].inUse && synthPool[i].baseFreq === frequencyForDisplay) {
            needDetune = true;
            break;
        }
    }
    
    // Also detune for consecutive hits on same line
    if (consecutiveHits > 1) needDetune = true;

    if (needDetune) {
        const cents = (Math.random() * 6) - 3; // -3 to +3
        const detuneFactor = Math.pow(2, cents / 1200);
        frequency *= detuneFactor;
        if (DEBUG_SOUND) console.log(`Detuned ${cents.toFixed(2)} cents -> ${frequency.toFixed(2)} Hz`);
    }

    // 音量だけ半減させる（オクターブシフトなし）
    const step = (consecutiveHits - 1) % 4; // 0,1,2,3...
    const volumeMultiplier = Math.pow(0.5, step); // 1, 0.5, 0.25, 0.125...
    
    // Calculate volume with line age factor (older lines = quieter)
    const currentTime = millis();
    const lineAge = currentTime - line.startTime;
    const LINE_LIFETIME = 10000; // 10 seconds
    const ageFactor = Math.max(0.5, 1 - (lineAge / LINE_LIFETIME) * 0.5); // 100% → 50%
    
    // Calculate frequency-based volume scaling (higher notes = quieter)
    const minFreq = playableScale[0]; // B3 (246.94Hz) - loudest
    const maxFreq = playableScale[playableScale.length - 1]; // G3 (196.00Hz) - quietest
    const freqProgress = (frequencyForDisplay - minFreq) / (maxFreq - minFreq); // 0→1
    const freqVolumeMultiplier = 1.0 - (freqProgress * 0.55); // 100% → 45% (55% reduction)
    
    const baseVolume = -15;
    const adjustedVolume = baseVolume + (20 * Math.log10(volumeMultiplier * ageFactor * freqVolumeMultiplier));
    
    // Temporarily adjust synth volume
    const originalVolume = availableSynth.synth.volume.value;
    availableSynth.synth.volume.value = adjustedVolume;
    
    // Set panning based on position if provided
    if (xPos !== null && width) {
        const panVal = (xPos / width) * 2 - 1; // -1 (left) to 1 (right)
        try {
            availableSynth.panner.pan.value = panVal;
        } catch (error) {
            console.warn('Failed to set pan value:', error);
        }
    }
    
    // Play the note with safer timing
    try {
        // Use setTimeout to ensure Tone.js is fully ready
        setTimeout(() => {
            try {
                if (availableSynth && availableSynth.synth) {
                    availableSynth.synth.triggerAttackRelease(frequency, 5); // 5-second note per requirement
                    availableSynth.inUse = true;
                    availableSynth.lastUsed = millis();
                    availableSynth.baseFreq = frequencyForDisplay; // Store base freq for detune checking
                    
                    if (DEBUG_SOUND) console.log(`Playing line sound: ${frequency.toFixed(2)} Hz (hit ${consecutiveHits}, vol x${volumeMultiplier.toFixed(3)})`);
                }
            } catch (playError) {
                console.error('Failed to trigger note:', playError);
            }
        }, 10); // 10ms delay for safety
        
        // Mark synth free after note plus small buffer
        setTimeout(() => {
            if (availableSynth) {
                availableSynth.inUse = false;
                availableSynth.baseFreq = null;
                try {
                    availableSynth.synth.volume.value = originalVolume;
                } catch (volumeError) {
                    console.warn('Failed to reset volume:', volumeError);
                }
            }
        }, 8600); // 5s note + 3s release + buffer
        
    } catch (error) {
        console.error('Failed to play line sound:', error);
    }
}

// Stop drone and fade out (for game over)
function stopDrone() {
    if (!audioInitialized || !drone) return;
    
    try {
        // Fade out over 10 seconds then stop
        drone.gainNode.gain.exponentialRampTo(0.001, 10);
        
        setTimeout(() => {
            if (drone) {
                drone.stop();
                drone.dispose();
                drone = null;
            }
        }, 10500); // Stop after fade completes
        
        if (DEBUG_SOUND) console.log('Drone stopping...');
    } catch (error) {
        console.error('Failed to stop drone:', error);
    }
}

// Clean up audio resources
function cleanupAudio() {
    if (!audioInitialized) return;
    
    try {
        // Stop and dispose of all synths
        synthPool.forEach(item => {
            item.synth.dispose();
        });
        synthPool = [];
        
        // Stop drone
        stopDrone();
        
        audioInitialized = false;
        if (DEBUG_SOUND) console.log('Audio cleaned up');
    } catch (error) {
        console.error('Failed to cleanup audio:', error);
    }
}

// Utility function to test audio
function testAudio() {
    if (!audioInitialized) {
        console.log('Audio not initialized');
        return;
    }
    
    // Play a test note
    const testLine = {
        points: [
            {x: 0, y: 0},
            {x: 100, y: 100}
        ]
    };
    
    playLineSound(testLine);
}

// Update drone panning each frame
function updateDronePan(ballX) {
    if (!audioInitialized || width === 0) return;
    const panVal = (ballX / width) * 2 - 1;
    try {
        if (dronePanner) dronePanner.pan.value = panVal;
        if (droneD3Panner) droneD3Panner.pan.value = panVal;
    } catch (error) {
        console.warn('Failed to update drone pan:', error);
    }
}

// Play start sound (A4 = 440Hz) using existing synth pool
function playStartSound() {
    if (!audioInitialized) {
        console.log('Audio not initialized for start sound');
        return;
    }
    
    // Additional safety check for Tone.js context
    if (Tone.context.state !== 'running') {
        console.log('Tone.js context not running, skipping start sound');
        return;
    }
    
    try {
        // Create a fake line to use existing playLineSound function
        // Find closest frequency to A4 (440Hz) in our playable scale
        let targetFreq = 440.0; // A4
        let closestIndex = 0;
        let minDiff = Math.abs(playableScale[0] - targetFreq);
        
        for (let i = 1; i < playableScale.length; i++) {
            const diff = Math.abs(playableScale[i] - targetFreq);
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        }
        
        // Calculate line length that would produce this frequency
        const maxLength = Math.hypot(width || 800, height || 600) * 0.25;
        const IS_TOUCH_DEVICE = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
        const effectiveMax = IS_TOUCH_DEVICE ? maxLength * 1.0 : maxLength * 0.67;
        
        // Reverse the mapping: we want the line length that produces closestIndex
        const normalized = closestIndex / (playableScale.length - 1); // 0〜1
        const inverted = 1 - normalized; // Invert because short lines = high notes
        const curved = Math.pow(inverted, 1/0.6); // Reverse the curve
        const fakeLineLength = curved * effectiveMax;
        
        // Create fake line object
        const fakeLine = {
            points: [
                {x: 0, y: 0},
                {x: fakeLineLength, y: 0}
            ],
            startTime: millis()
        };
        
                 // Use existing playLineSound with center position
         const centerX = (width || 800) / 2;
         playLineSound(fakeLine, 1, centerX);
         
         // Boost start sound volume temporarily by adjusting master gain
         if (typeof Tone !== 'undefined' && Tone.Destination && Tone.Destination.volume) {
             const originalVolume = Tone.Destination.volume.value;
             Tone.Destination.volume.value = originalVolume + 12; // +12dB boost for start sound
             setTimeout(() => {
                 Tone.Destination.volume.value = originalVolume; // Restore original volume
             }, 3000); // 3秒後に元に戻す
         }
        
        console.log(`Start sound: using closest note ${playableNoteNames[closestIndex]} (${playableScale[closestIndex].toFixed(1)}Hz) for A4 request`);
        
    } catch (error) {
        console.error('Failed to play start sound:', error);
    }
}

// Export for sketch.js
if (typeof window !== 'undefined') {
    window.updateDronePan = updateDronePan;
    window.playStartSound = playStartSound;
} 