// ============================================================
//  CONFIGURAÇÕES DO JOGO (GRADE, TAMANHO, CORES)
// ============================================================
const GRID_SIZE = 22;
const CELL_SIZE = 24;
const BOARD_WIDTH = GRID_SIZE * CELL_SIZE;
const BOARD_HEIGHT = GRID_SIZE * CELL_SIZE;
const UI_HEIGHT = 80;
const CANVAS_W = BOARD_WIDTH;
const CANVAS_H = BOARD_HEIGHT + UI_HEIGHT;

// Cores
const COLOR_BG = "#0b1f18";
const COLOR_GRID = "#1f4635";
const COLOR_SNAKE_HEAD = "#8effb2";
const COLOR_SNAKE_BODY = "#2d9c5c";
const COLOR_TEXT = "#d9ffeb";
const COLOR_UI_BG = "#0a1914";

// Frutas e suas cores
const FRUIT_NORMAL = { name: "normal", color: "#ff5e6b", glow: "#ff8c94", points: 1 };
const FRUIT_GOLDEN = { name: "golden", color: "#ffd966", glow: "#ffb347", points: 3, effect: "extraPoints" };
const FRUIT_SPEED = { name: "speed", color: "#5dade2", glow: "#85c1e9", points: 1, effect: "speedBoost", duration: 5000 };
const FRUIT_SLOW = { name: "slow", color: "#af7ac5", glow: "#d2b4de", points: 1, effect: "slowDown", duration: 4000 };
const FRUIT_INVERT = { name: "invert", color: "#2ecc71", glow: "#a3e4d7", points: 1, effect: "invertControls", duration: 6000 };

let fruitTypes = [FRUIT_NORMAL, FRUIT_GOLDEN, FRUIT_SPEED, FRUIT_SLOW, FRUIT_INVERT];
let currentFruit = { ...FRUIT_NORMAL, x: 12, y: 12 };

// Estados
const STATE_START = "start";
const STATE_PLAYING = "playing";
const STATE_PAUSED = "paused";
const STATE_GAMEOVER = "gameover";

// ============================================================
//  VARIÁVEIS GLOBAIS
// ============================================================
let snake = [];
let direction = "RIGHT";
let nextDirection = "RIGHT";
let score = 0;
let highScore = 0;
let gameState = STATE_START;

// Velocidade
let baseDelay = 150;
let currentDelay = baseDelay;
let lastMoveTime = 0;
let speedMultiplier = 1.0;
let invertedControls = false;
let effectEndTime = 0;

// Partículas
let particles = [];

// ============================================================
//  SISTEMA DE ÁUDIO SEGURO (NUNCA QUEBRA O JOGO)
// ============================================================
let eatSound = null;
let powerUpSound = null;
let gameOverSound = null;
let bgMusic = null;
let bgMusicEnabled = false;

function initSounds() {
    if (typeof Audio === 'undefined') {
        console.log("Áudio não suportado pelo navegador.");
        return;
    }
    
    function createSound(src, volume = 0.5, loop = false) {
        try {
            let sound = new Audio();
            sound.src = src;
            sound.volume = volume;
            sound.loop = loop;
            sound.load();
            sound.onerror = () => {
                console.warn(`⚠️ Não foi possível carregar: ${src}`);
                sound.enabled = false;
            };
            return sound;
        } catch(e) {
            console.warn("Erro ao criar áudio:", e);
            return null;
        }
    }
    
    eatSound = createSound("sounds/eat.ogg", 0.1, false);
    powerUpSound = createSound("sounds/powerup.mp3", 0.6, false);
    gameOverSound = createSound("sounds/gameover.mp3", 0.6, false);
    bgMusic = createSound("sounds/bgmusic.mp3", 0.09, true);
    
    console.log("Sons e música configurados (desabilitados por padrão). Para ativar, descomente as linhas em initSounds() e adicione os arquivos .mp3 na pasta 'sounds'.");
}

function playSound(sound) {
    if (sound && sound.enabled !== false) {
        try {
            sound.currentTime = 0;
            let promise = sound.play();
            if (promise !== undefined) promise.catch(e => console.log("Áudio bloqueado pelo navegador."));
        } catch(e) {}
    }
}

function startBackgroundMusic() {
    if (bgMusic && bgMusic.enabled !== false && !bgMusicEnabled) {
        bgMusicEnabled = true;
        try {
            let promise = bgMusic.play();
            if (promise !== undefined) promise.catch(e => console.log("Música de fundo não iniciou automaticamente."));
        } catch(e) {}
    }
}

function stopBackgroundMusic() {
    if (bgMusic && bgMusic.enabled !== false) {
        bgMusic.pause();
        bgMusic.currentTime = 0;
        bgMusicEnabled = false;
    }
}

function pauseBackgroundMusic() {
    if (bgMusic && bgMusic.enabled !== false && !bgMusic.paused) {
        bgMusic.pause();
    }
}

function resumeBackgroundMusic() {
    if (bgMusic && bgMusic.enabled !== false && bgMusicEnabled && bgMusic.paused) {
        try {
            bgMusic.play().catch(e => console.log("Não foi possível retomar música."));
        } catch(e) {}
    }
}

// ============================================================
//  FUNÇÕES AUXILIARES
// ============================================================
function isPositionFree(pos, ignoreTail = false) {
    if (pos.x < 0 || pos.x >= GRID_SIZE || pos.y < 0 || pos.y >= GRID_SIZE) return false;
    let snakeCheck = snake;
    if (ignoreTail && snake.length > 0) snakeCheck = snake.slice(0, -1);
    for (let seg of snakeCheck) if (seg.x === pos.x && seg.y === pos.y) return false;
    return true;
}

function generateRandomFruit() {
    let r = random(1);
    let fruitType;
    if (r < 0.6) fruitType = FRUIT_NORMAL;
    else {
        let specials = [FRUIT_GOLDEN, FRUIT_SPEED, FRUIT_SLOW, FRUIT_INVERT];
        fruitType = random(specials);
    }
    let maxAttempts = 2000;
    for (let i = 0; i < maxAttempts; i++) {
        let randX = floor(random(GRID_SIZE));
        let randY = floor(random(GRID_SIZE));
        if (isPositionFree({ x: randX, y: randY }, false)) {
            currentFruit = { ...fruitType, x: randX, y: randY };
            return true;
        }
    }
    for (let i = 0; i < GRID_SIZE; i++)
        for (let j = 0; j < GRID_SIZE; j++)
            if (isPositionFree({ x: i, y: j }, false)) {
                currentFruit = { ...fruitType, x: i, y: j };
                return true;
            }
    return false;
}

function updateBaseSpeedFromScore() {
    let reduction = floor(score / 4) * 4;
    baseDelay = max(55, 150 - reduction);
    applySpeedMultiplier();
}

function applySpeedMultiplier() {
    let effective = baseDelay;
    if (speedMultiplier !== 1.0) effective = baseDelay * speedMultiplier;
    currentDelay = constrain(effective, 40, 300);
}

function startEffect(effect, duration) {
    effectEndTime = millis() + duration;
    switch (effect) {
        case "speedBoost":
            speedMultiplier = 0.6;
            break;
        case "slowDown":
            speedMultiplier = 1.4;
            break;
        case "invertControls":
            invertedControls = true;
            break;
    }
    applySpeedMultiplier();
    playSound(powerUpSound); //SOM DE POWER-UP
}

function updateActiveEffects() {
    let now = millis();
    if (effectEndTime > 0 && now >= effectEndTime) {
        speedMultiplier = 1.0;
        invertedControls = false;
        effectEndTime = 0;
        applySpeedMultiplier();
    }
}

// ============================================================
//  LÓGICA DA COBRA
// ============================================================
function checkCollision(head, ignoreTail) {
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) return true;
    let snakeToCheck = snake;
    if (ignoreTail && snake.length > 0) snakeToCheck = snake.slice(0, -1);
    for (let seg of snakeToCheck) if (seg.x === head.x && seg.y === head.y) return true;
    return false;
}

function performMove() {
    let rawDir = nextDirection;
    if (invertedControls) {
        let invertMap = { "UP": "DOWN", "DOWN": "UP", "LEFT": "RIGHT", "RIGHT": "LEFT" };
        rawDir = invertMap[rawDir] || rawDir;
    }
    if ((rawDir === "RIGHT" && direction === "LEFT") ||
        (rawDir === "LEFT" && direction === "RIGHT") ||
        (rawDir === "UP" && direction === "DOWN") ||
        (rawDir === "DOWN" && direction === "UP")) {
        rawDir = direction;
    }
    direction = rawDir;
    
    let head = snake[0];
    let newHead = { ...head };
    switch (direction) {
        case "RIGHT": newHead.x++; break;
        case "LEFT": newHead.x--; break;
        case "UP": newHead.y--; break;
        case "DOWN": newHead.y++; break;
    }
    
    const willEat = (newHead.x === currentFruit.x && newHead.y === currentFruit.y);
    const ignoreTailForCollision = !willEat;
    if (checkCollision(newHead, ignoreTailForCollision)) return false;
    
    snake.unshift(newHead);
    
    if (willEat) {
        let gainedPoints = currentFruit.points;
        score += gainedPoints;
        if (score > highScore) highScore = score;
        
        playSound(eatSound); // 🔊 SOM DE COMER FRUTA
        createParticles(currentFruit.x * CELL_SIZE + CELL_SIZE/2, currentFruit.y * CELL_SIZE + CELL_SIZE/2, currentFruit.color);
        
        if (currentFruit.effect) {
            startEffect(currentFruit.effect, currentFruit.duration);
        }
        
        updateBaseSpeedFromScore();
        if (!generateRandomFruit()) return false;
    } else {
        snake.pop();
    }
    return true;
}

// Partículas
function createParticles(x, y, color) {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x: x, y: y,
            vx: random(-2, 2),
            vy: random(-2, 2),
            life: 255,
            color: color,
            size: random(3, 8)
        });
    }
}

function updateParticles() {
    for (let i = particles.length-1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 8;
        if (p.life <= 0) particles.splice(i,1);
    }
}

function drawParticles() {
    noStroke();
    for (let p of particles) {
        fill(red(p.color), green(p.color), blue(p.color), p.life);
        ellipse(p.x, p.y, p.size);
    }
}

// ============================================================
//  RENDERIZAÇÃO
// ============================================================
function drawGrid() {
    stroke(COLOR_GRID);
    strokeWeight(0.6);
    for (let i = 0; i <= GRID_SIZE; i++) {
        line(i*CELL_SIZE, 0, i*CELL_SIZE, BOARD_HEIGHT);
        line(0, i*CELL_SIZE, BOARD_WIDTH, i*CELL_SIZE);
    }
}

function drawSnake() {
    for (let i=0; i<snake.length; i++) {
        let seg = snake[i];
        let isHead = (i===0);
        fill(isHead ? COLOR_SNAKE_HEAD : COLOR_SNAKE_BODY);
        stroke(isHead ? "#ccffdd" : "#1e6b44");
        strokeWeight(isHead ? 1.8 : 1.2);
        rect(seg.x*CELL_SIZE, seg.y*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1, 6);
    }
    let headPos = snake[0];
    if (headPos) {
        fill(0);
        noStroke();
        let eyeOffset = CELL_SIZE*0.25;
        let eyeSize = CELL_SIZE*0.15;
        if (direction === "RIGHT") {
            ellipse(headPos.x*CELL_SIZE + CELL_SIZE - eyeOffset, headPos.y*CELL_SIZE + eyeOffset, eyeSize, eyeSize);
            ellipse(headPos.x*CELL_SIZE + CELL_SIZE - eyeOffset, headPos.y*CELL_SIZE + CELL_SIZE - eyeOffset, eyeSize, eyeSize);
        } else if (direction === "LEFT") {
            ellipse(headPos.x*CELL_SIZE + eyeOffset, headPos.y*CELL_SIZE + eyeOffset, eyeSize, eyeSize);
            ellipse(headPos.x*CELL_SIZE + eyeOffset, headPos.y*CELL_SIZE + CELL_SIZE - eyeOffset, eyeSize, eyeSize);
        } else if (direction === "UP") {
            ellipse(headPos.x*CELL_SIZE + eyeOffset, headPos.y*CELL_SIZE + eyeOffset, eyeSize, eyeSize);
            ellipse(headPos.x*CELL_SIZE + CELL_SIZE - eyeOffset, headPos.y*CELL_SIZE + eyeOffset, eyeSize, eyeSize);
        } else {
            ellipse(headPos.x*CELL_SIZE + eyeOffset, headPos.y*CELL_SIZE + CELL_SIZE - eyeOffset, eyeSize, eyeSize);
            ellipse(headPos.x*CELL_SIZE + CELL_SIZE - eyeOffset, headPos.y*CELL_SIZE + CELL_SIZE - eyeOffset, eyeSize, eyeSize);
        }
    }
}

function drawFruit() {
    let pulse = sin(millis() * 0.012) * 0.2 + 0.8;
    fill(currentFruit.color);
    stroke(currentFruit.glow);
    strokeWeight(2);
    let x = currentFruit.x * CELL_SIZE;
    let y = currentFruit.y * CELL_SIZE;
    ellipse(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE * 0.75 * pulse, CELL_SIZE * 0.75 * pulse);
    fill(255, 220, 140);
    noStroke();
    ellipse(x + CELL_SIZE/2 + 2, y + CELL_SIZE/2 - 2, CELL_SIZE * 0.2, CELL_SIZE * 0.2);
}

function drawUI() {
    fill(COLOR_UI_BG);
    noStroke();
    rect(0, BOARD_HEIGHT, CANVAS_W, UI_HEIGHT);
    
    fill(COLOR_TEXT);
    textSize(28);
    textFont('monospace');
    textStyle(BOLD);
    textAlign(LEFT, CENTER);
    text("🍎 " + score, 25, BOARD_HEIGHT + UI_HEIGHT/2 - 15);
    textAlign(RIGHT, CENTER);
    text("🏆 " + highScore, CANVAS_W - 25, BOARD_HEIGHT + UI_HEIGHT/2 - 15);
    
    if (effectEndTime > 0) {
        let remaining = ceil((effectEndTime - millis())/1000);
        let effectText = "";
        if (speedMultiplier < 1) effectText = "⚡ SPEED BOOST";
        else if (speedMultiplier > 1) effectText = "🐢 SLOW DOWN";
        else if (invertedControls) effectText = "🔄 INVERTED";
        if (effectText) {
            textSize(16);
            textAlign(CENTER, CENTER);
            fill(255, 220, 100);
            text(`${effectText} (${remaining}s)`, CANVAS_W/2, BOARD_HEIGHT + UI_HEIGHT - 18);
        }
    }
    
    let speedPercent = map(currentDelay, 40, 150, 100, 20);
    speedPercent = constrain(speedPercent, 20, 100);
    fill(50,200,100);
    rect(40, BOARD_HEIGHT + UI_HEIGHT - 12, (CANVAS_W-80)*(speedPercent/100), 6, 3);
    fill(30,70,40);
    rect(40, BOARD_HEIGHT + UI_HEIGHT - 12, CANVAS_W-80, 6, 3);
    fill(100,255,150);
    rect(40, BOARD_HEIGHT + UI_HEIGHT - 12, (CANVAS_W-80)*(speedPercent/100), 6, 3);
}

function drawStartScreen() {
    drawGameVisualsOnly();
    fill(0,0,0,200);
    rect(0,0,CANVAS_W, BOARD_HEIGHT);
    fill(COLOR_TEXT);
    textSize(42);
    textAlign(CENTER,CENTER);
    text("🐍 SNAKE EVO", CANVAS_W/2, BOARD_HEIGHT/2 - 40);
    textSize(20);
    fill(200,255,210);
    text("▲ ▼ ◀ ▶   ou   W A S D", CANVAS_W/2, BOARD_HEIGHT/2 + 20);
    textSize(18);
    fill(150,240,180);
    text("Pressione [ENTER] para começar", CANVAS_W/2, BOARD_HEIGHT/2 + 70);
    textSize(14);
    fill(180);
    text("Frutas especiais trazem efeitos temporários!", CANVAS_W/2, BOARD_HEIGHT/2 + 115);
}

function drawGameVisualsOnly() {
    background(COLOR_BG);
    drawGrid();
    drawSnake();
    drawFruit();
    drawParticles();
}

function drawGameplay() {
    drawGameVisualsOnly();
    drawUI();
}

function drawPausedOverlay() {
    fill(0,0,0,190);
    rect(0,0,CANVAS_W, BOARD_HEIGHT);
    textSize(32);
    textAlign(CENTER,CENTER);
    fill(255,240,150);
    text("⏸ PAUSADO", CANVAS_W/2, BOARD_HEIGHT/2 - 20);
    textSize(18);
    fill(210);
    text("Pressione [P] para continuar", CANVAS_W/2, BOARD_HEIGHT/2 + 30);
}

function drawGameOverScreen() {
    drawGameVisualsOnly();
    fill(0,0,0,210);
    rect(0,0,CANVAS_W, BOARD_HEIGHT);
    fill(255,100,110);
    textSize(42);
    textAlign(CENTER,CENTER);
    text("💀 GAME OVER 💀", CANVAS_W/2, BOARD_HEIGHT/2 - 45);
    fill(COLOR_TEXT);
    textSize(28);
    text("Pontuação: " + score, CANVAS_W/2, BOARD_HEIGHT/2 + 10);
    textSize(22);
    fill(250,220,100);
    text("Recorde: " + highScore, CANVAS_W/2, BOARD_HEIGHT/2 + 55);
    textSize(18);
    fill(180,230,200);
    text("Pressione [ENTER] para jogar novamente", CANVAS_W/2, BOARD_HEIGHT/2 + 110);
}

// ============================================================
//  SETUP E LOOP PRINCIPAL
// ============================================================
function setup() {
    let canvas = createCanvas(CANVAS_W, CANVAS_H);
    canvas.parent("canvas-container");
    frameRate(60);
    textFont("'Courier New', monospace");
    initSounds();
    resetGameData();
    gameState = STATE_START;
    lastMoveTime = millis();
}

function resetGameData() {
    let centerX = floor(GRID_SIZE/2);
    let centerY = floor(GRID_SIZE/2);
    snake = [
        { x: centerX, y: centerY },
        { x: centerX-1, y: centerY },
        { x: centerX-2, y: centerY }
    ];
    direction = "RIGHT";
    nextDirection = "RIGHT";
    score = 0;
    baseDelay = 150;
    speedMultiplier = 1;
    invertedControls = false;
    effectEndTime = 0;
    applySpeedMultiplier();
    generateRandomFruit();
    particles = [];
    lastMoveTime = millis();
}

function startNewGame() {
    resetGameData();
    gameState = STATE_PLAYING;
    startBackgroundMusic(); // 🔊 INICIA MÚSICA DE FUNDO
}

function draw() {
    updateActiveEffects();
    updateParticles();
    
    if (gameState === STATE_PLAYING) {
        let now = millis();
        if (now - lastMoveTime >= currentDelay) {
            let success = performMove();
            lastMoveTime = now;
            if (!success) {
                gameState = STATE_GAMEOVER;
                playSound(gameOverSound); // 🔊 SOM DE GAME OVER
                stopBackgroundMusic();    // 🎵 PARA MÚSICA
            }
        }
    }
    
    switch (gameState) {
        case STATE_START:
            drawStartScreen();
            drawUI();
            break;
        case STATE_PLAYING:
            drawGameplay();
            break;
        case STATE_PAUSED:
            drawGameplay();
            drawPausedOverlay();
            break;
        case STATE_GAMEOVER:
            drawGameOverScreen();
            drawUI();
            break;
    }
    
    if (gameState === STATE_PLAYING) {
        fill(255,255,200,80);
        noStroke();
        textSize(12);
        textAlign(RIGHT,BOTTOM);
        text("[P] Pausa", CANVAS_W-12, BOARD_HEIGHT-8);
    }
}

// ============================================================
//  EVENTOS DE TECLADO (CONTROLE E ÁUDIO)
// ============================================================
function keyPressed() {
    let controlKeys = [UP_ARROW, DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW, 87,65,83,68,80,13];
    if (controlKeys.includes(keyCode)) event.preventDefault?.();
    
    if (gameState === STATE_PLAYING) {
        let newDir = null;
        if (keyCode === RIGHT_ARROW || key === 'd' || key === 'D') newDir = "RIGHT";
        else if (keyCode === LEFT_ARROW || key === 'a' || key === 'A') newDir = "LEFT";
        else if (keyCode === UP_ARROW || key === 'w' || key === 'W') newDir = "UP";
        else if (keyCode === DOWN_ARROW || key === 's' || key === 'S') newDir = "DOWN";
        
        if (newDir) {
            nextDirection = newDir;
            return false;
        }
        if (key === 'p' || key === 'P') {
            gameState = STATE_PAUSED;
            pauseBackgroundMusic();  // 🎵 PAUSA MÚSICA
            return false;
        }
    }
    else if (gameState === STATE_PAUSED) {
        if (key === 'p' || key === 'P') {
            gameState = STATE_PLAYING;
            resumeBackgroundMusic(); // 🎵 RETOMA MÚSICA
            lastMoveTime = millis();
            return false;
        }
    }
    
    if (keyCode === 13) { // ENTER
        if (gameState === STATE_START || gameState === STATE_GAMEOVER) {
            startNewGame();
        }
        return false;
    }
    
    if ((key === 'r' || key === 'R') && (gameState === STATE_GAMEOVER || gameState === STATE_START)) {
        startNewGame();
        return false;
    }
    return false;
}

// Expor funções para o p5.js
window.setup = setup;
window.draw = draw;
window.keyPressed = keyPressed;