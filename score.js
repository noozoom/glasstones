// GlassTones score.js 

let score = 0;
let hitLines = new Set(); // Track which lines have been hit for scoring

// Initialize score display
function initializeScore() {
    updateScoreDisplay();
}

// Update score display in HTML
function updateScoreDisplay() {
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        scoreElement.style.display = 'none'; // スコアを非表示にする
    }
}

// Add points when ball hits a line for the first time
function addScore(line, points = 10) {
    // Check if this line has already been hit
    if (hitLines.has(line.id)) {
        return false; // No score added
    }
    
    // Add line to hit set and increase score
    hitLines.add(line.id);
    score += points;
    updateScoreDisplay();
    
    console.log(`Score: ${score} (+${points})`);
    return true; // Score was added
}

// Reset score (for new game)
function resetScore() {
    score = 0;
    hitLines.clear();
    updateScoreDisplay();
    console.log('Score reset');
}

// Get current score
function getScore() {
    return score;
}

// Clean up expired lines from hit tracking
function cleanupExpiredLines(currentLines) {
    // Create a set of current line IDs
    const currentLineIds = new Set(currentLines.map(line => line.id));
    
    // Remove any hit line IDs that are no longer in the current lines
    const expiredHits = [];
    hitLines.forEach(lineId => {
        if (!currentLineIds.has(lineId)) {
            expiredHits.push(lineId);
        }
    });
    
    // Remove expired hits
    expiredHits.forEach(lineId => {
        hitLines.delete(lineId);
    });
    
    if (expiredHits.length > 0) {
        console.log(`Cleaned up ${expiredHits.length} expired line hits`);
    }
}

// Check if a line has already been hit
function isLineHit(lineId) {
    return hitLines.has(lineId);
}

// Get total number of unique lines hit
function getHitLineCount() {
    return hitLines.size;
}

// Display score animation (for future enhancement)
function showScoreAnimation(x, y, points) {
    // This could be enhanced with p5.js to show floating score text
    // For now, just log the score gain
    console.log(`+${points} at (${x.toFixed(0)}, ${y.toFixed(0)})`);
} 