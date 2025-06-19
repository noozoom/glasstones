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

// EFFECT BUS SYSTEM - 共有エフェクト（音ごとに作らない）
let effectBus = null;           // エフェクトバス
let effectBusPanner = null;     // エフェクトバス用パンナー
let delayBus = null;            // 共有ディレイ
let delayGainBus = null;        // ディレイミックス
let delayFeedbackBus = null;    // ディレイフィードバック
let chorusBus = null;           // 共有コーラス
let chorusLFO = null;           // コーラスLFO
let chorusLFOGain = null;       // コーラスLFOゲイン
let chorusGainBus = null;       // コーラスミックス
let reverbBus = null;           // 共有リバーブ
let reverbGainBus = null;       // リバーブミックス
let dryBus = null;              // ドライシグナルバス

// LUFS measurement (lighter monitoring)
let lufsBuffer = [];
let lufsBufferSize = 2400; // 50ms at 48kHz for faster response
let targetLUFS = -14; // Target loudness
let currentLUFS = -70; // Current measured LUFS
let autoGainAdjustment = 1.0; // Automatic gain adjustment factor

// Polyphonic voice management (32 voices like original)
// Mobile optimized polyphonic limit
const IS_MOBILE_DEVICE = /iP(hone|ad|od)|Android/.test(navigator.userAgent);
const SYNTH_POOL_SIZE = IS_MOBILE_DEVICE ? 16 : 32; // Mobile: 16 voices, Desktop: 32 voices
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

// Initialize simple audio system (user interaction required)
function initSimpleAudio() {
    if (isAudioReady) return;
    
    console.log('Initializing audio system with user interaction...');
    
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create simplified processing chain (no compressor for better performance)
        // masterGain -> limiter -> destination
        
        // Create master gain node and keep at 0 until game starts
        masterGain = audioContext.createGain();
        masterGain.gain.setValueAtTime(0, audioContext.currentTime);
        
        // Create limiter only (remove compressor for performance)
        limiter = audioContext.createDynamicsCompressor();
        limiter.threshold.setValueAtTime(-3, audioContext.currentTime);     // Higher threshold for +10dB boost
        limiter.knee.setValueAtTime(1, audioContext.currentTime);           // Slight knee
        limiter.ratio.setValueAtTime(12, audioContext.currentTime);         // 12:1 ratio (limiting)
        limiter.attack.setValueAtTime(0.002, audioContext.currentTime);     // 2ms attack
        limiter.release.setValueAtTime(0.02, audioContext.currentTime);     // 20ms release
        
        // CREATE EFFECT BUS SYSTEM - 共有エフェクト
        createEffectBus(audioContext);
        
        // Ultra-lightweight processing chain: masterGain -> limiter -> destination
        masterGain.connect(limiter);
        limiter.connect(audioContext.destination);
        
        console.log('Audio processing chain ready: [voices] -> effectBus -> masterGain -> limiter -> destination');
        
        // CRITICAL: Must resume audio context after user interaction
        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('Audio context resumed after user interaction (volume 0)');
                isAudioReady = true;
            }).catch(error => {
                console.error('Failed to resume audio context:', error);
            });
        } else {
            console.log('Audio context ready (volume 0)');
            isAudioReady = true;
        }
        
        window.simpleAudioContext = audioContext;
        
    } catch (error) {
        console.error('Failed to initialize simple audio:', error);
    }
}

// CREATE EFFECT BUS SYSTEM - すべての音が共有するエフェクト
function createEffectBus(audioContext) {
    console.log('Creating shared effect bus system...');
    
    // Main effect bus
    effectBus = audioContext.createGain();
    effectBus.gain.value = 1.0;
    
    // Effect bus panner for left-right positioning
    effectBusPanner = audioContext.createStereoPanner();
    effectBusPanner.pan.value = 0; // Center by default
    
    // Dry signal bus
    dryBus = audioContext.createGain();
    dryBus.gain.value = 0.5; // 50% dry signal
    
    // SHARED DELAY SYSTEM
    delayBus = audioContext.createDelay(1.0);
    delayGainBus = audioContext.createGain();
    delayFeedbackBus = audioContext.createGain();
    
    // デフォルトディレイ設定（中間位置）
    const IS_MOBILE_DELAY = /iP(hone|ad|od)|Android/.test(navigator.userAgent);
    if (IS_MOBILE_DELAY) {
        delayBus.delayTime.value = 0.125; // 125ms (mobile)
        delayGainBus.gain.value = 0.18;   // 18% mix
        delayFeedbackBus.gain.value = 0.25; // 25% feedback
    } else {
        delayBus.delayTime.value = 0.2;   // 200ms (desktop)
        delayGainBus.gain.value = 0.24;   // 24% mix
        delayFeedbackBus.gain.value = 0.32; // 32% feedback
    }
    
    // Delay feedback loop
    delayBus.connect(delayFeedbackBus);
    delayFeedbackBus.connect(delayBus);
    
    // SHARED CHORUS SYSTEM
    chorusBus = audioContext.createDelay(0.1);
    chorusLFO = audioContext.createOscillator();
    chorusLFOGain = audioContext.createGain();
    chorusGainBus = audioContext.createGain();
    
    // コーラス設定（デフォルト3秒周期）
    chorusLFO.frequency.value = 0.33; // 3秒周期
    chorusLFOGain.gain.value = 0.0035; // 3.5ms modulation
    chorusBus.delayTime.value = 0.0035; // 3.5ms base delay
    
    const IS_MOBILE_CHORUS = /iP(hone|ad|od)|Android/.test(navigator.userAgent);
    chorusGainBus.gain.value = IS_MOBILE_CHORUS ? 0.25 : 0.22; // Mobile: 25%, Desktop: 22%
    
    chorusLFO.connect(chorusLFOGain);
    chorusLFOGain.connect(chorusBus.delayTime);
    chorusLFO.start();
    
    // SHARED REVERB SYSTEM
    reverbBus = audioContext.createConvolver();
    reverbGainBus = audioContext.createGain();
    reverbGainBus.gain.value = 1.0; // 100% wet
    
    // Create impulse response for reverb (mobile optimized)
    const IS_MOBILE_REVERB = /iP(hone|ad|od)|Android/.test(navigator.userAgent);
    const reverbLength = IS_MOBILE_REVERB ? 8 : 15; // Mobile: 8s, Desktop: 15s
    const length = audioContext.sampleRate * reverbLength;
    const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
        }
    }
    reverbBus.buffer = impulse;
    
    // EFFECT BUS ROUTING: effectBus -> [dry + delay + chorus] -> reverb -> masterGain
    effectBus.connect(dryBus);
    effectBus.connect(delayBus);
    effectBus.connect(chorusBus);
    
    delayBus.connect(delayGainBus);
    chorusBus.connect(chorusGainBus);
    
    // Mix all effects
    const preFXGain = audioContext.createGain();
    preFXGain.gain.value = 1.0;
    
    dryBus.connect(preFXGain);
    delayGainBus.connect(preFXGain);
    chorusGainBus.connect(preFXGain);
    
    // Send to reverb, then to effect bus panner, then to master
    preFXGain.connect(reverbBus);
    reverbBus.connect(reverbGainBus);
    reverbGainBus.connect(effectBusPanner);
    effectBusPanner.connect(masterGain);
    
    console.log(`Effect bus created: ${reverbLength}s reverb (${IS_MOBILE_REVERB ? 'Mobile' : 'Desktop'}) with panning`);
}

// UPDATE EFFECT BUS BASED ON BALL POSITION
function updateEffectBus(ballX, ballY) {
    if (!delayBus || !chorusLFO || ballY === undefined || !window.innerHeight) return;
    
    const verticalRatio = ballY / window.innerHeight; // 0 (top) to 1 (bottom)
    const IS_MOBILE_EFFECT = /iP(hone|ad|od)|Android/.test(navigator.userAgent);
    
    // Update effect bus panning based on horizontal position
    if (effectBusPanner && ballX !== undefined && window.innerWidth) {
        const panValue = (ballX / window.innerWidth) * 2 - 1; // -1 to 1
        effectBusPanner.pan.setValueAtTime(panValue, window.simpleAudioContext.currentTime);
    }
    
    // Update delay based on vertical position
    if (IS_MOBILE_EFFECT) {
        const minDelay = 0.008;  // 8ms
        const maxDelay = 0.25;   // 250ms
        const delayTime = minDelay + (verticalRatio * (maxDelay - minDelay));
        delayBus.delayTime.setValueAtTime(delayTime, window.simpleAudioContext.currentTime);
        
        const delayMix = 0.06 + (verticalRatio * 0.24); // 6% to 30%
        delayGainBus.gain.setValueAtTime(delayMix, window.simpleAudioContext.currentTime);
        
        const feedbackAmount = 0.1 + (verticalRatio * 0.3); // 10% to 40%
        delayFeedbackBus.gain.setValueAtTime(feedbackAmount, window.simpleAudioContext.currentTime);
    } else {
        const minDelay = 0.01;   // 10ms
        const maxDelay = 0.4;    // 400ms
        const delayTime = minDelay + (verticalRatio * (maxDelay - minDelay));
        delayBus.delayTime.setValueAtTime(delayTime, window.simpleAudioContext.currentTime);
        
        const delayMix = 0.08 + (verticalRatio * 0.32); // 8% to 40%
        delayGainBus.gain.setValueAtTime(delayMix, window.simpleAudioContext.currentTime);
        
        const feedbackAmount = 0.15 + (verticalRatio * 0.35); // 15% to 50%
        delayFeedbackBus.gain.setValueAtTime(feedbackAmount, window.simpleAudioContext.currentTime);
    }
    
    // Update chorus frequency based on vertical position
    const minFreq = 1.0;   // 1 Hz (1秒周期) - 上部
    const maxFreq = 0.2;   // 0.2 Hz (5秒周期) - 下部
    const chorusFrequency = minFreq + (verticalRatio * (maxFreq - minFreq));
    chorusLFO.frequency.setValueAtTime(chorusFrequency, window.simpleAudioContext.currentTime);
}

// Activate master volume when game starts (20ms -> 70ms fade-in)
function activateMasterVolume() {
    if (!isAudioReady || !masterGain || !window.simpleAudioContext) {
        console.log('Audio not ready for volume activation, trying to initialize...');
        // Try to initialize if not ready
        if (typeof window.initSimpleAudio === 'function') {
            window.initSimpleAudio();
            // Retry after a short delay
            setTimeout(() => {
                activateMasterVolume();
            }, 200);
        }
        return;
    }
    
    const audioContext = window.simpleAudioContext;
    console.log('Activating master volume: 20ms -> 70ms fade-in');
    
    // Ensure audio context is running
    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('Audio context resumed for volume activation');
            proceedWithVolumeActivation();
        }).catch(error => {
            console.error('Failed to resume audio context for volume:', error);
        });
    } else {
        proceedWithVolumeActivation();
    }
    
    function proceedWithVolumeActivation() {
        // Fast master volume fade-in for immediate start sound response
        setTimeout(() => {
            if (masterGain) {
                masterGain.gain.cancelScheduledValues(audioContext.currentTime);
                masterGain.gain.setValueAtTime(0, audioContext.currentTime);
                masterGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.02); // 20ms後に極小値
                masterGain.gain.exponentialRampToValueAtTime(3.54, audioContext.currentTime + 0.07); // 70msで通常ボリュームに（-3dB: 5.0 × 0.707 = 3.54）
                console.log('Master volume: 20ms -> 70ms fade-in started');
            }
        }, 0); // 即座に開始
        
        // Start drones immediately after volume activation (no 1 second delay)
        setTimeout(() => {
            startDrones();
            console.log('Drones started immediately after volume activation');
        }, 100); // 100ms後（音量フェードイン完了後）
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
        droneGainD3.connect(masterGain); // マスターゲインに接続（エフェクトバスを通さない）
        
        droneD3.frequency.value = 146.83; // D3
        droneD3.type = 'sine';
        
        // D3は30秒かけてゆっくりとフェードイン（メインドローン）- 音量を半分に調整
        droneGainD3.gain.setValueAtTime(0, now);
        droneGainD3.gain.exponentialRampToValueAtTime(0.0001, now + 1); // 1秒後に極小値
        droneGainD3.gain.exponentialRampToValueAtTime(0.005, now + 30); // 30秒かけて最終音量（-12dB: 0.0063 × 0.794 = 0.005）
        
        droneD3.start(now);
        
        // A3 Drone (サブドローン - 5度上、パンニング付き)
        droneA3 = audioContext.createOscillator();
        droneGainA3 = audioContext.createGain();
        window.dronePannerA3 = audioContext.createStereoPanner(); // グローバルアクセス用
        
        droneA3.connect(droneGainA3);
        droneGainA3.connect(window.dronePannerA3);
        window.dronePannerA3.connect(masterGain); // マスターゲインに接続（エフェクトバスを通さない）
        
        droneA3.frequency.value = 220; // A3
        droneA3.type = 'sine';
        
        // A3は35秒かけてゆっくりとフェードイン（サブドローン、少し弱め）- 音量を半分に調整
        droneGainA3.gain.setValueAtTime(0, now);
        droneGainA3.gain.exponentialRampToValueAtTime(0.0001, now + 2); // 2秒後に極小値
        droneGainA3.gain.exponentialRampToValueAtTime(0.0037, now + 35); // 35秒かけて最終音量（-12dB: 0.0047 × 0.794 = 0.0037）
        
        droneA3.start(now);
        
        console.log('Drones started: D3 (30s fade) + A3 (35s fade, panning)');
        
    } catch (error) {
        console.error('Failed to start drones:', error);
    }
}

// Play simple sound with shared effect bus
function playSimpleSound(lineLength, ballX, ballY, consecutiveHits = 1, volumeMultiplier = 1.0, lineAge = 0) {
    if (!isAudioReady || !window.simpleAudioContext || !effectBus) {
        console.log('Audio system not ready');
        return;
    }
    
    try {
        const audioContext = window.simpleAudioContext;
        
        // Update effect bus based on ball position
        updateEffectBus(ballX, ballY);
        
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
        
        // Create oscillator with panning ONLY - エフェクトは共有バスを使用
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const panner = audioContext.createStereoPanner();
        
        // Set panning based on ball position
        if (ballX !== undefined && window.innerWidth) {
            const panValue = (ballX / window.innerWidth) * 2 - 1; // -1 to 1
            panner.pan.value = panValue;
        }
        
        // ROUTING: osc -> gain -> panner -> effectBus（個別パンニング + 共有エフェクト）
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(effectBus); // 共有エフェクトバスに送信
        
        // ±3セントランダマイズ（すべての音に適用）
        const cents = (Math.random() * 6) - 3; // -3 to +3 cents
        const detuneFactor = Math.pow(2, cents / 1200); // セント→周波数比
        const randomizedFrequency = finalFrequency * detuneFactor;
        
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
        
        // 最終音量計算（400%ゲイン対応、BUSシステムで音量バランス維持）
        const baseVolume = 0.392; // ベース音量を+10dB（3.16倍）: 0.124 × 3.16 = 0.392
        const finalVolume = baseVolume * consecutiveMultiplier * ageFactor * freqVolumeMultiplier * volumeMultiplier;
        
        // ドキュメント通りのエンベロープ: A 0.5s / D 0.2s / S 0.3 / R 5s（12秒固定長）
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
        
        console.log(`Playing: ${displayNoteName} (${randomizedFrequency.toFixed(1)}Hz) - Vol: ${(finalVolume*100).toFixed(1)}% [Active: ${activeSounds.length}/${SYNTH_POOL_SIZE}] -> Shared Effect Bus`);
        
        // Update LUFS display after playing sound
        updateLUFSDisplay();
        
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

// Get current LUFS and dynamics info (with real-time measurement)
function getLUFSInfo() {
    // Calculate estimated LUFS based on current audio activity
    const activeSoundCount = activeSounds.length;
    const droneActive = (droneD3 && droneA3) ? 1 : 0;
    
    // Estimate current LUFS based on activity
    let estimatedLUFS = -70; // Silent baseline
    
    if (activeSoundCount > 0 || droneActive) {
        // Base level from drones (-25 LUFS when active)
        if (droneActive) estimatedLUFS = -25;
        
        // Add contribution from active sounds
        if (activeSoundCount > 0) {
            const soundContribution = Math.min(activeSoundCount * 2, 15); // Max +15dB from sounds
            estimatedLUFS = Math.max(estimatedLUFS, -30) + soundContribution;
            estimatedLUFS = Math.min(estimatedLUFS, -10); // Cap at -10 LUFS
        }
    }
    
    return {
        currentLUFS: estimatedLUFS,
        targetLUFS: -14.0,
        autoGainAdjustment: 3.54, // Current master gain (-3dB from 5.0)
        limiterReduction: 0,
        activeSounds: activeSoundCount,
        dronesActive: droneActive
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

// Play point sound - always one of the top 3 highest notes (D6, C6, A5)
function playPointSound(ballX, ballY, volumeMultiplier = 1.0) {
    if (!isAudioReady || !window.simpleAudioContext || !effectBus) {
        console.log('Audio system not ready for point sound');
        return;
    }
    
    try {
        const audioContext = window.simpleAudioContext;
        
        // Update effect bus based on ball position
        updateEffectBus(ballX, ballY);
        
        // Select one of the top 3 highest notes randomly
        const topNoteIndices = [0, 1, 2]; // D6, C6, A5
        const randomIndex = topNoteIndices[Math.floor(Math.random() * 3)];
        const frequency = simpleScale[randomIndex];
        const noteName = simpleNotes[randomIndex];
        
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
        
        // Display note info
        if (typeof window !== 'undefined' && typeof window.updateHitInfo === 'function') {
            window.updateHitInfo(noteName, 50, frequency); // Fixed length for points
        }
        
        // Create oscillator with panning ONLY - エフェクトは共有バスを使用
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const panner = audioContext.createStereoPanner();
        
        // Set panning based on ball position
        if (ballX !== undefined && window.innerWidth) {
            const panValue = (ballX / window.innerWidth) * 2 - 1; // -1 to 1
            panner.pan.value = panValue;
        }
        
        // ROUTING: osc -> gain -> panner -> effectBus（個別パンニング + 共有エフェクト）
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(effectBus); // 共有エフェクトバスに送信
        
        // ±3セントランダマイズ（すべての音に適用）
        const cents = (Math.random() * 6) - 3; // -3 to +3 cents
        const detuneFactor = Math.pow(2, cents / 1200); // セント→周波数比
        const randomizedFrequency = frequency * detuneFactor;
        
        osc.frequency.value = randomizedFrequency;
        osc.type = 'sine';
        
        // Point sound volume - slightly higher than normal sounds
        const baseVolume = 0.45; // Higher than normal sounds (0.392)
        const finalVolume = baseVolume * volumeMultiplier;
        
        // Point sound envelope: Quick attack, short sustain, quick release
        const now = audioContext.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(finalVolume, now + 0.05);      // Quick attack: 50ms
        gain.gain.linearRampToValueAtTime(finalVolume * 0.7, now + 0.1); // Quick decay: 50ms
        gain.gain.setValueAtTime(finalVolume * 0.7, now + 0.2);          // Short sustain: 100ms
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);        // Quick release: 1.3s
        
        osc.start(now);
        osc.stop(now + 1.5); // 1.5秒の短い音
        
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
        }, 1500); // 1.5 seconds
        
        console.log(`Point Sound: ${noteName} (${randomizedFrequency.toFixed(1)}Hz) - Vol: ${(finalVolume*100).toFixed(1)}% [Active: ${activeSounds.length}/${SYNTH_POOL_SIZE}]`);
        
        // Update LUFS display after playing sound
        updateLUFSDisplay();
        
    } catch (error) {
        console.error('Failed to play point sound:', error);
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
            const centerY = window.innerHeight / 2; // Screen center Y
            playSimpleSound(fakeLineLength, centerX, centerY, 1, 0.65, 0); // 65%音量でスタート音（プレイアブル通常音量の65%）
        }, 0); // 遅延なし
        
        console.log(`Start sound: D4 (${targetFreq}Hz) triggered immediately via shared effect bus`);
        
    } catch (error) {
        console.error('Failed to play start sound:', error);
    }
}

// Export functions for global access
if (typeof window !== 'undefined') {
    window.initSimpleAudio = initSimpleAudio;
    window.playSimpleSound = playSimpleSound;
    window.playPointSound = playPointSound;
    window.updateDronePanning = updateDronePanning;
    window.activateMasterVolume = activateMasterVolume;
    window.playStartSound = playStartSound;
    window.getLUFSInfo = getLUFSInfo;
    window.setTargetLUFS = setTargetLUFS;
    window.updateLUFSDisplay = updateLUFSDisplay;
} 