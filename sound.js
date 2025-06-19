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

// Lydian scale frequencies (G2-D5) — 実際のライン音は B2 (index 2) 以上を使用
const lydianScale = [
    185.00,  // F#3
    196.00,  // G3
    220.00,  // A3
    246.94,  // B3
    277.18,  // C#4
    293.66,  // D4
    329.63,  // E4
    392.00,  // G4
    880.00,  // A5
    1108.73, // C#6
    1174.66  // D6
];

// 対応する音名
const lydianNoteNames = [
    "F#3","G3","A3","B3","C#4","D4","E4","G4","A5","C#6","D6"
];

// Alias for existing code
const phrygianScale = lydianScale;
const phrygianNoteNames = lydianNoteNames;

// -----------------------------
//  playableScale : B2〜D5 から A2・D3 を除いたライン用スケール
//    idx >= 2 で A2 以前をカット、さらに idx !== 4 で D3 を除外
// -----------------------------
const playableScale = lydianScale.filter((_, idx) => idx >= 2 && idx !== 4);
const playableNoteNames = lydianNoteNames.filter((_, idx) => idx >= 2 && idx !== 4);

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
        });
    } catch (error) {
        console.error('Failed to initialize audio:', error);
    }
}

// Setup the A2 drone bass
function setupDrone() {
    // Detect mobile devices for extra audio safety
    const isMobile = /iP(hone|ad|od)|Android/.test(navigator.userAgent);
    const fadeTime = isMobile ? 4 : 3; // Longer fade on mobile
    
    // ---------- A2 Drone ----------
    dronePanner = new Tone.Panner(0).toDestination();
    const droneGain = new Tone.Gain(0).connect(dronePanner);
    drone = new Tone.Oscillator({
        frequency: 110.00, // A2 (110.00Hz) - direct frequency
        type: "sine",
        volume: -20 // Base volume
    }).connect(droneGain);
    
    // Mobile-safe drone start
    if (isMobile) {
        // Extra delay before starting on mobile
        setTimeout(() => {
            drone.start();
            // Start completely silent, then fade in over 4 seconds on mobile
            droneGain.gain.setValueAtTime(0, Tone.now());
            droneGain.gain.exponentialRampTo(0.0001, 0.2); // Very quiet first, longer ramp
            droneGain.gain.exponentialRampTo(0.422, fadeTime);
        }, 200); // 200ms delay on mobile
    } else {
        drone.start();
        // Start completely silent, then fade in over 3 seconds on desktop
        droneGain.gain.setValueAtTime(0, Tone.now());
        droneGain.gain.exponentialRampTo(0.001, 0.1);
        droneGain.gain.exponentialRampTo(0.422, fadeTime);
    }
    drone.gainNode = droneGain;

    // ---------- D3 Drone ---------- (frequency 146.83Hz)
    droneD3Panner = new Tone.Panner(0).toDestination();
    const droneD3Gain = new Tone.Gain(0).connect(droneD3Panner);
    droneD3 = new Tone.Oscillator({
        frequency: 146.83, // D3
        type: "sine",
        volume: -20
    }).connect(droneD3Gain);
    
    // Mobile-safe D3 drone start
    if (isMobile) {
        // Extra delay before starting on mobile
        setTimeout(() => {
            droneD3.start();
            // Start completely silent, then fade in over 4 seconds on mobile
            droneD3Gain.gain.setValueAtTime(0, Tone.now());
            droneD3Gain.gain.exponentialRampTo(0.0001, 0.2); // Very quiet first, longer ramp
            droneD3Gain.gain.exponentialRampTo(0.422, fadeTime);
        }, 250); // Slightly staggered from first drone
    } else {
        droneD3.start();
        // Start completely silent, then fade in over 3 seconds on desktop
        droneD3Gain.gain.setValueAtTime(0, Tone.now());
        droneD3Gain.gain.exponentialRampTo(0.001, 0.1);
        droneD3Gain.gain.exponentialRampTo(0.422, fadeTime);
    }
    droneD3.gainNode = droneD3Gain;
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
            volume: -15
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
    // モバイルでは音階変化を緩やかに（より長い線で低音が出るよう調整）
    const IS_MOBILE_AUDIO = /iP(hone|ad|od)|Android/.test(navigator.userAgent);
    const effectiveMax = IS_MOBILE_AUDIO ? maxLength * 0.4 : maxLength * 0.67; // Mobile: 倍の長さで低音が出るよう
    const normalized = Math.min(lineLength / effectiveMax, 1);   // 0〜1 (長いほど1)
    const inverted = 1 - normalized;                          // 短いほど1
    const curved = Math.pow(inverted, 0.6);                   // カーブをかけて短線強調

    // playableScale 0 = B2, 最終 = D5 (D3 を除外)
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
        if (DEBUG_SOUND) console.log('Audio not initialized yet, but displaying note info');
        return; // Skip actual sound but display was already updated
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
    const minFreq = playableScale[0]; // A3 (220.00Hz) - loudest
    const maxFreq = playableScale[playableScale.length - 1]; // D6 (1174.66Hz) - quietest
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
        availableSynth.panner.pan.rampTo(panVal, 0.05);
    }
    
    // Play the note
    try {
        availableSynth.synth.triggerAttackRelease(frequency, 5); // 5-second note per requirement
        availableSynth.inUse = true;
        availableSynth.lastUsed = millis();
        availableSynth.baseFreq = frequencyForDisplay; // Store base freq for detune checking
        
        // Mark synth free after note plus small buffer
        setTimeout(() => {
            availableSynth.inUse = false;
            availableSynth.baseFreq = null;
            availableSynth.synth.volume.value = originalVolume;
        }, 8600); // 5s note + 3s release + buffer
        
        if (DEBUG_SOUND) console.log(`Playing line sound: ${frequency.toFixed(2)} Hz (hit ${consecutiveHits}, vol x${volumeMultiplier.toFixed(3)})`);
    } catch (error) {
        console.error('Failed to play line sound:', error);
    }
}

// Stop drone and fade out (for game over)
function stopDrone() {
    if (!audioInitialized || !drone) return;
    
    try {
        // Fade out over 10 seconds then stop
        drone.gainNode.gain.rampTo(0, 10);
        
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
    if (dronePanner) dronePanner.pan.rampTo(panVal, 0.1);
    if (droneD3Panner) droneD3Panner.pan.rampTo(panVal, 0.1);
}

// Export for sketch.js
if (typeof window !== 'undefined') {
    window.updateDronePan = updateDronePan;
} 