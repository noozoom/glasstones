// Simple and safe sound system for GlassTones with Limiter and LUFS metering

let isAudioReady = false;
let simpleOsc = null;
let simpleGain = null;

// Drone oscillators
let droneD3 = null;
let droneA3 = null;
let droneGainD3 = null;
let droneGainA3 = null;

// Master volume control with simplified dynamics processing
let masterGain = null;
let limiter = null;
let analyser = null;

// LUFS measurement (lighter monitoring)
let lufsBuffer = [];
let lufsBufferSize = 2400; // 50ms at 48kHz for faster response
let targetLUFS = -14; // Target loudness
let currentLUFS = -70; // Current measured LUFS
let autoGainAdjustment = 1.0; // Automatic gain adjustment factor

// Polyphonic voice management (32 voices like original)
const SYNTH_POOL_SIZE = 32;
let activeSounds = [];
let lastPlayTime = {}; // Track last play time for each frequency
const MIN_REPLAY_INTERVAL = 30; // 30ms minimum between same frequency replays (より短く)

// 最新の音階 + A4追加 + D4/C4追加 (短い線ほど高音、長い線ほど低音)
const simpleScale = [
    1174.66, // D6 (最高音・短い線)
    1046.50, // C6
    880.00,  // A5 (スタート音)
    440.00,  // A4
    392.00,  // G4
    329.63,  // E4
    293.66,  // D4
    261.63,  // C4 (追加)
    246.94,  // B3
    196.00,  // G3
    164.81,  // E3
    130.81,  // C3
    110.00,  // A2
    73.42    // D2 (最低音・長い線)
];
const simpleNotes = ["D6", "C6", "A5", "A4", "G4", "E4", "D4", "C4", "B3", "G3", "E3", "C3", "A2", "D2"];

// LUFS calculation (simplified ITU-R BS.1770 implementation)
function calculateLUFS(audioData) {
    if (!audioData || audioData.length === 0) return -70;
    
    // K-weighting filter approximation (simplified)
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
        // Simple RMS calculation with K-weighting approximation
        const sample = audioData[i];
        sum += sample * sample;
    }
    
    const meanSquare = sum / audioData.length;
    if (meanSquare <= 0) return -70;
    
    // Convert to LUFS (approximation)
    const lufs = -0.691 + 10 * Math.log10(meanSquare);
    return Math.max(-70, Math.min(0, lufs));
}

// Update LUFS measurement and auto-gain
// iPhone performance: Completely disable heavy LUFS measurement
function updateLUFSMeasurement() {
    // Disabled for iPhone performance - no analyser, no LUFS calculation
    // Just maintain fixed gain for stable audio
    return;
}

// Initialize simple audio system
function initSimpleAudio() {
    if (isAudioReady) return;
    
    console.log('Initializing lightweight audio with limiter only...');
    
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create simplified processing chain (no compressor for better performance)
        // masterGain -> limiter -> analyser -> destination
        
        // Create master gain node and set to 0 initially (プツ音防止)
        masterGain = audioContext.createGain();
        masterGain.gain.setValueAtTime(0, audioContext.currentTime);
        
        // Create limiter only (remove compressor for performance)
        limiter = audioContext.createDynamicsCompressor();
        limiter.threshold.setValueAtTime(-3, audioContext.currentTime);     // Higher threshold for +10dB boost
        limiter.knee.setValueAtTime(1, audioContext.currentTime);           // Slight knee
        limiter.ratio.setValueAtTime(12, audioContext.currentTime);         // 12:1 ratio (limiting)
        limiter.attack.setValueAtTime(0.002, audioContext.currentTime);     // 2ms attack
        limiter.release.setValueAtTime(0.02, audioContext.currentTime);     // 20ms release
        
        // iPhone performance: Skip heavy analyser processing
        // analyser = audioContext.createAnalyser();
        // analyser.fftSize = 1024;
        // analyser.smoothingTimeConstant = 0.5;
        
        // Ultra-lightweight processing chain: masterGain -> limiter -> destination
        masterGain.connect(limiter);
        limiter.connect(audioContext.destination);
        
        console.log('Ultra-lightweight processing chain: masterGain -> limiter -> destination (no analyser)');
        
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('Audio context resumed');
                isAudioReady = true;
                // 30ms後にマスターボリュームを素早くフェードイン（スタート音対応）
                setTimeout(() => {
                    if (masterGain) {
                        // 現在の値から素早くフェードイン
                        masterGain.gain.cancelScheduledValues(audioContext.currentTime);
                        masterGain.gain.setValueAtTime(0, audioContext.currentTime);
                        masterGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.03); // 30ms後に極小値
                        masterGain.gain.exponentialRampToValueAtTime(6.32, audioContext.currentTime + 0.08); // 80msで通常ボリュームに（400%相当: 1.58 × 4.0）
                        console.log('Master volume fading in over 80ms for quick start sound response');
                        // iPhone performance: Skip heavy LUFS monitoring
                        // setInterval(updateLUFSMeasurement, 200);
                    }
                }, 30);
                // 1秒遅延でドローンを開始（マスターフェードイン完了後）
                setTimeout(() => {
                    startDrones();
                }, 1000);
            });
        } else {
            isAudioReady = true;
            // 30ms後にマスターボリュームを素早くフェードイン（スタート音対応）
            setTimeout(() => {
                if (masterGain) {
                    // 現在の値から素早くフェードイン
                    masterGain.gain.cancelScheduledValues(audioContext.currentTime);
                    masterGain.gain.setValueAtTime(0, audioContext.currentTime);
                    masterGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.03); // 30ms後に極小値
                    masterGain.gain.exponentialRampToValueAtTime(6.32, audioContext.currentTime + 0.08); // 80msで通常ボリュームに（400%相当: 1.58 × 4.0）
                    console.log('Master volume fading in over 80ms for quick start sound response');
                    // iPhone performance: Skip heavy LUFS monitoring
                    // setInterval(updateLUFSMeasurement, 200);
                }
            }, 30);
            // 1秒遅延でドローンを開始（マスターフェードイン完了後）
            setTimeout(() => {
                startDrones();
            }, 1000);
        }
        
        window.simpleAudioContext = audioContext;
        
    } catch (error) {
        console.error('Failed to initialize simple audio:', error);
    }
}

// Start drone sounds
function startDrones() {
    if (!isAudioReady || !window.simpleAudioContext) return;
    
    try {
        const audioContext = window.simpleAudioContext;
        
        // D3 Drone (メインドローン - ルート音)
        const now = audioContext.currentTime;
        droneD3 = audioContext.createOscillator();
        droneGainD3 = audioContext.createGain();
        
        droneD3.connect(droneGainD3);
        droneGainD3.connect(masterGain); // マスターゲインに接続
        
        droneD3.frequency.value = 146.83; // D3
        droneD3.type = 'sine';
        
        // D3は30秒かけてゆっくりとフェードイン（メインドローン）
        droneGainD3.gain.setValueAtTime(0, now);
        droneGainD3.gain.exponentialRampToValueAtTime(0.0001, now + 1); // 1秒後に極小値
        droneGainD3.gain.exponentialRampToValueAtTime(0.0025, now + 30); // 30秒かけて最大値へ（400%ゲイン対応: 0.01 / 4.0）
        
        droneD3.start(now); // 即座に開始
        
        // A3 Drone (サブドローン - 5度上) - with panning
        droneA3 = audioContext.createOscillator();
        droneGainA3 = audioContext.createGain();
        window.dronePannerA3 = audioContext.createStereoPanner(); // Global for ball position updates
        
        droneA3.connect(droneGainA3);
        droneGainA3.connect(window.dronePannerA3);
        window.dronePannerA3.connect(masterGain); // マスターゲインに接続
        
        droneA3.frequency.value = 220.00; // A3
        droneA3.type = 'sine';
        
        // A3は少し遅れて開始
        droneGainA3.gain.setValueAtTime(0, now);
        droneGainA3.gain.exponentialRampToValueAtTime(0.0001, now + 2); // 2秒後に極小値
        droneGainA3.gain.exponentialRampToValueAtTime(0.00185, now + 35); // 35秒かけて最大値へ（400%ゲイン対応: 0.0074 / 4.0）
        
        droneA3.start(now + 1); // 1秒遅れて開始
        
        console.log('Drones started with very slow attack');
        
    } catch (error) {
        console.error('Failed to start drones:', error);
    }
}

// Play simple sound with panning
function playSimpleSound(lineLength, ballX, consecutiveHits = 1, volumeMultiplier = 1.0, lineAge = 0) {
    if (!isAudioReady || !window.simpleAudioContext) {
        console.log('Audio not ready, trying to initialize...');
        initSimpleAudio();
        return;
    }
    
    try {
        const audioContext = window.simpleAudioContext;
        
        // Calculate frequency from line length (短い線ほど高音、長い線ほど低音)
        const maxLength = Math.hypot(window.innerWidth, window.innerHeight) * 0.25;
        
        // モバイル判定（スマホはさらに1.5倍長い線が必要）
        const IS_MOBILE_AUDIO = /iP(hone|ad|od)|Android/.test(navigator.userAgent);
        const effectiveMax = IS_MOBILE_AUDIO ? maxLength * 3.0 : maxLength * 1.34; // モバイル: 3.0倍の長さで低音（2.0→3.0）
        
        const normalized = Math.min(lineLength / effectiveMax, 1);   // 0〜1 (長いほど1)
        
        // 高音域を広くマッピング（低音と高音の差を2倍に）
        // 指数カーブを調整: 高音域（0〜0.67）は緩やか、低音域（0.67〜1）は急激
        let curved;
        if (normalized < 0.67) {
            // 高音域: より緩やかなカーブ（2倍広いマッピング）
            curved = Math.pow(normalized / 0.67, 1.5) * 0.67; // 0〜0.67の範囲を0〜0.67にマッピング
        } else {
            // 低音域: より急激なカーブ
            curved = 0.67 + Math.pow((normalized - 0.67) / 0.33, 0.5) * 0.33; // 0.67〜1の範囲を0.67〜1にマッピング
        }
        
        const index = Math.round(curved * (simpleScale.length - 1)); // 長いほど高いindex（低音）
        const frequency = simpleScale[index]; // 長い線ほど低音、短い線ほど高音
        const noteName = simpleNotes[index];
        
        // 6秒以内の同音発生チェック（違う線・同じ線問わず）
        const currentTime = Date.now();
        const SAME_NOTE_INTERVAL = 6000; // 6秒
        const freqKey = frequency.toString();
        let finalFrequency = frequency;
        let finalIndex = index;
        
        // 6秒以内に同じ音が鳴っていた場合、隣接音階を選択
        if (lastPlayTime[freqKey] && (currentTime - lastPlayTime[freqKey]) < SAME_NOTE_INTERVAL) {
            console.log(`Same frequency ${frequency}Hz within 6 seconds (${currentTime - lastPlayTime[freqKey]}ms ago), selecting adjacent note`);
            
            // 隣接音階を選択（上か下かランダム）
            const goUp = Math.random() < 0.5;
            let newIndex = finalIndex;
            
            if (goUp && finalIndex > 0) {
                newIndex = finalIndex - 1; // 上の音階（配列の前方）
            } else if (!goUp && finalIndex < simpleScale.length - 1) {
                newIndex = finalIndex + 1; // 下の音階（配列の後方）
            } else if (finalIndex === 0) {
                newIndex = 1; // 最高音の場合は下に
            } else if (finalIndex === simpleScale.length - 1) {
                newIndex = finalIndex - 1; // 最低音の場合は上に
            }
            
            finalIndex = newIndex;
            finalFrequency = simpleScale[finalIndex];
            console.log(`Adjacent note selected: ${simpleNotes[finalIndex]} (${finalFrequency.toFixed(1)}Hz)`);
        }
        
        // 連打判定（50ms以内の同一周波数）
        const finalFreqKey = finalFrequency.toString();
        if (lastPlayTime[finalFreqKey] && (currentTime - lastPlayTime[finalFreqKey]) < MIN_REPLAY_INTERVAL) {
            console.log(`Final frequency ${finalFrequency}Hz played too soon (${currentTime - lastPlayTime[finalFreqKey]}ms ago), skipping`);
            return;
        }
        lastPlayTime[finalFreqKey] = currentTime;
        
        // Check polyphonic limit (32ボイス制限)
        if (activeSounds.length >= SYNTH_POOL_SIZE) {
            // Stop oldest sound
            const oldest = activeSounds.shift();
            if (oldest && oldest.osc) {
                try {
                    oldest.osc.stop();
                } catch (e) {
                    // Ignore if already stopped
                }
            }
            console.log(`Polyphonic limit reached (${SYNTH_POOL_SIZE}), stopped oldest sound`);
        }
        
        // Display note info (隣接音階が選ばれた場合は更新された音名を表示)
        const displayNoteName = simpleNotes[finalIndex];
        if (typeof window !== 'undefined' && typeof window.updateHitInfo === 'function') {
            window.updateHitInfo(displayNoteName, lineLength, finalFrequency);
        }
        
        // Create oscillator with panning and reverb
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const panner = audioContext.createStereoPanner();
        const convolver = audioContext.createConvolver();
        const wetGain = audioContext.createGain();
        const dryGain = audioContext.createGain();
        
        // Create impulse response for reverb (15秒のリバーブ)
        if (!convolver.buffer) {
            const length = audioContext.sampleRate * 15; // 15 second reverb (元の設定に戻す)
            const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
            for (let channel = 0; channel < 2; channel++) {
                const channelData = impulse.getChannelData(channel);
                for (let i = 0; i < length; i++) {
                    channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
                }
            }
            convolver.buffer = impulse;
        }
        
        // Set panning based on ball position
        if (ballX !== undefined && window.innerWidth) {
            const panValue = (ballX / window.innerWidth) * 2 - 1; // -1 to 1
            panner.pan.value = panValue;
        }
        
        // Audio routing: osc -> gain -> panner -> [dry/wet split] -> destination
        osc.connect(gain);
        gain.connect(panner);
        
        // コーラス効果を追加
        const chorusGain = audioContext.createGain();
        const chorusDelay = audioContext.createDelay(0.1);
        const chorusLFO = audioContext.createOscillator();
        const chorusLFOGain = audioContext.createGain();
        
        // コーラス設定 (3秒周期のゆっくりしたモジュレーション)
        chorusLFO.frequency.value = 0.33; // 3-second period (1/3 Hz)
        chorusLFOGain.gain.value = 0.0035; // 3.5ms delay modulation
        chorusDelay.delayTime.value = 0.0035; // 3.5ms base delay
        
        chorusLFO.connect(chorusLFOGain);
        chorusLFOGain.connect(chorusDelay.delayTime);
        chorusLFO.start();
        
        // Audio routing: panner -> [dry + chorus] -> reverb -> destination
        panner.connect(dryGain);
        panner.connect(chorusDelay);
        chorusDelay.connect(chorusGain);
        
        // Mix dry and chorus signals
        const preFXGain = audioContext.createGain();
        dryGain.connect(preFXGain);
        chorusGain.connect(preFXGain);
        
        // Send mixed signal to reverb
        preFXGain.connect(convolver);
        convolver.connect(wetGain);
        wetGain.connect(masterGain); // マスターゲインに接続
        
        // Gain settings
        dryGain.gain.value = 0.7; // 70% dry
        chorusGain.gain.value = 0.3; // 30% chorus
        wetGain.gain.value = 1.0; // 100% wet (全信号をリバーブに送る)
        
        // ±3セントランダマイズ（すべての音に適用）
        const cents = (Math.random() * 6) - 3; // -3 to +3 cents
        const detuneFactor = Math.pow(2, cents / 1200); // セント→周波数比
        const randomizedFrequency = finalFrequency * detuneFactor;
        console.log(`3-cent randomization applied: ${cents.toFixed(2)} cents -> ${randomizedFrequency.toFixed(2)}Hz`);
        
        osc.frequency.value = randomizedFrequency;
        osc.type = 'sine';
        
        // 音量制御の計算
        // 1. 連打による音量減衰 (1, 0.5, 0.25, 0.125...)
        const step = (consecutiveHits - 1) % 4; // 0,1,2,3...
        const consecutiveMultiplier = Math.pow(0.5, step);
        
        // 2. 線の古さによる音量減衰 (古い線ほど静か)
        const LINE_LIFETIME = 10000; // 10秒
        const ageFactor = Math.max(0.5, 1 - (lineAge / LINE_LIFETIME) * 0.5); // 100% → 50%
        
        // 3. 高い音ほど音量を下げる (高音55%減衰)
        const minFreq = simpleScale[simpleScale.length - 1]; // D2 (最低音) - 一番大きい
        const maxFreq = simpleScale[0]; // D6 (最高音) - 一番小さい
        const freqProgress = (frequency - minFreq) / (maxFreq - minFreq); // 0→1 (高音ほど1)
        const freqVolumeMultiplier = 1.0 - (freqProgress * 0.55); // 100% → 45% (55% reduction)
        
        // 最終音量計算（400%ゲイン対応）
        const baseVolume = 0.124; // ベース音量（400%ゲイン時と同等: 0.493 / 4.0）
        const finalVolume = baseVolume * consecutiveMultiplier * ageFactor * freqVolumeMultiplier * volumeMultiplier;
        
        // ドキュメント通りのエンベロープ: A 0.5s / D 0.2s / S 0.3 / R 5s
        const now = audioContext.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(finalVolume, now + 0.5);      // Attack: 0.5秒
        gain.gain.linearRampToValueAtTime(finalVolume * 0.3, now + 0.5 + 0.2); // Decay: 0.2秒
        gain.gain.setValueAtTime(finalVolume * 0.3, now + 0.7);              // Sustain: 0.3レベル
        gain.gain.exponentialRampToValueAtTime(0.001, now + 12); // Release: 5秒（12秒固定長）
        
        osc.start(now);
        osc.stop(now + 12); // 12秒固定長（ドキュメント通り）
        
        // Add to active sounds for polyphonic management
        const soundInfo = {
            osc: osc,
            startTime: now,
            frequency: frequency
        };
        activeSounds.push(soundInfo);
        
        // Auto-remove from activeSounds when sound ends
        setTimeout(() => {
            const index = activeSounds.indexOf(soundInfo);
            if (index > -1) {
                activeSounds.splice(index, 1);
            }
        }, 12000); // 12 seconds
        
        console.log(`Playing: ${displayNoteName} (${randomizedFrequency.toFixed(1)}Hz) - Vol: ${(finalVolume*100).toFixed(1)}% (consecutive:${consecutiveMultiplier.toFixed(2)}, age:${ageFactor.toFixed(2)}, freq:${freqVolumeMultiplier.toFixed(2)}, base:${volumeMultiplier.toFixed(2)}) [Active: ${activeSounds.length}/${SYNTH_POOL_SIZE}]`);
        
    } catch (error) {
        console.error('Failed to play simple sound:', error);
    }
}

// Update A3 drone panning based on ball position
function updateDronePanning(ballX) {
    if (window.dronePannerA3 && ballX !== undefined && window.innerWidth) {
        const panValue = (ballX / window.innerWidth) * 2 - 1; // -1 to 1
        window.dronePannerA3.pan.value = panValue;
    }
}

// Get current LUFS and dynamics info (simplified for iPhone)
function getLUFSInfo() {
    return {
        currentLUFS: -14.0, // Fixed value for iPhone performance
        targetLUFS: -14.0,
        autoGainAdjustment: 4.0, // Fixed 400% (same as before)
        limiterReduction: 0
    };
}

// Set target LUFS
function setTargetLUFS(lufs) {
    targetLUFS = Math.max(-70, Math.min(0, lufs));
    console.log(`Target LUFS set to: ${targetLUFS}`);
}

// Update display with LUFS info (if display function exists)
function updateLUFSDisplay() {
    if (typeof window !== 'undefined' && typeof window.updateLUFSInfo === 'function') {
        const info = getLUFSInfo();
        window.updateLUFSInfo(info);
    }
}

// Play start sound (D4 = 293.66Hz) using playSimpleSound - immediate trigger
function playStartSound() {
    if (!isAudioReady || !window.simpleAudioContext) {
        console.log('Audio not ready for start sound');
        return;
    }
    
    try {
        // D4は音階の6番目（index 6）にある
        const targetFreq = 293.66; // D4
        const targetIndex = 6; // D4のインデックス
        
        // 短い線でD4が出るような線の長さを計算
        const maxLength = Math.hypot(window.innerWidth, window.innerHeight) * 0.25;
        const IS_MOBILE_AUDIO = /iP(hone|ad|od)|Android/.test(navigator.userAgent);
        const effectiveMax = IS_MOBILE_AUDIO ? maxLength * 3.0 : maxLength * 1.34;
        
        // D4のインデックス（6）から線の長さを逆算
        const normalizedIndex = targetIndex / (simpleScale.length - 1); // 0〜1
        
        // 逆カーブ計算
        let curved;
        if (normalizedIndex < 0.67) {
            curved = Math.pow(normalizedIndex / 0.67, 1/1.5) * 0.67;
        } else {
            curved = 0.67 + Math.pow((normalizedIndex - 0.67) / 0.33, 2) * 0.33;
        }
        const normalized = 1 - curved; // 短い線ほど高音なので反転
        const fakeLineLength = normalized * effectiveMax;
        
        // 画面中央でプレイアブルシンセを即座に使用（遅延なし）
        const centerX = window.innerWidth ? window.innerWidth / 2 : 400;
        
        // 即座にトリガー - マスターフェーダーが立ち上がるのを待たない
        setTimeout(() => {
            playSimpleSound(fakeLineLength, centerX, 1, 0.65, 0); // 65%音量でスタート音（プレイアブル通常音量の65%）
        }, 0); // 遅延なし
        
        console.log(`Start sound: D4 (${targetFreq}Hz) triggered immediately - master fader will handle volume`);
        
    } catch (error) {
        console.error('Failed to play start sound:', error);
    }
}

// Export for global access
if (typeof window !== 'undefined') {
    window.initSimpleAudio = initSimpleAudio;
    window.playSimpleSound = playSimpleSound;
    window.playStartSound = playStartSound;
    window.updateDronePanning = updateDronePanning;
    window.getLUFSInfo = getLUFSInfo;
    window.setTargetLUFS = setTargetLUFS;
    window.updateLUFSDisplay = updateLUFSDisplay;
} 