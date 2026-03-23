// Game Constants
const TILE_SIZE = 20;
const GAME_WIDTH = 1000;
const GAME_HEIGHT = 700;
const DAD_HITBOX_SIZE = 22;
const MAX_OVERSTIMULATION = 100;
// Baseline stress model constants
// How quickly stress rises while moving (points per second)
const BASE_MOVE_RATE = 0.8;
// How quickly stress falls when standing still (points per second)
const BASE_STILL_RATE = 0.8;
// Additional calming when holding the action key while still (points per second)
const BASE_EXTRA_CALM_RATE = 1.2;
// How much incomplete tasks contribute to ambient stress (points per second when fully overloaded)
const EXTRA_TASK_STRESS_RATE = 0.8;
const DAYS = 2;
const SPRINKLER_SCHEDULE = [45, 165, 225];
const BEER_TIME = 180;
const CHICKEN_CURFEW_TIME = 240;
const CHICKEN_PANIC_TIME = 270;

// Debug mode (press D to toggle)
let DEBUG_MODE = false;
let DEBUG_SPEED_MULTIPLIER = 2;

// ===== TEXT RENDERING UTILITY =====
// Draw text with black outline for readability
function drawTextWithBorder(text, x, y, fillStyle = '#fff', fontSize = '12px monospace', borderWidth = 3) {
    ctx.font = fontSize;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.strokeStyle = '#000';
    ctx.lineWidth = borderWidth;
    ctx.strokeText(text, x, y);

    ctx.fillStyle = fillStyle;
    ctx.fillText(text, x, y);
}

let input = {
    up: false,
    down: false,
    left: false,
    right: false,
    action: false,
    actionHeld: false,
    actionStartTime: 0,
    sprinting: false,
    bark: false,
    interact: false  // Secondary interact for NPCs (separate from action)
};

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;
const touchButtons = document.querySelectorAll('[data-touch]');
const playtestElements = {
    panel: document.getElementById('playtest-panel'),
    status: document.getElementById('playtest-status'),
    summary: document.getElementById('playtest-summary'),
    details: document.getElementById('playtest-details'),
    events: document.getElementById('playtest-events'),
    collapse: document.getElementById('playtest-collapse'),
    toggle: document.getElementById('playtest-toggle'),
    speed: document.getElementById('playtest-speed'),
    export: document.getElementById('playtest-export'),
    reset: document.getElementById('playtest-reset')
};
const PLAYTEST_SPEEDS = [1, 2, 4];
const PLAYTEST_LOG_LIMIT = 8;
const BOT_CONTROLLED_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'e', 'shift', 'q', 'r']);
const PLAYTEST_QUERY = new URLSearchParams(window.location.search);
const AUTOSTART_PLAYTEST = PLAYTEST_QUERY.get('autoplay') === '1';
const AUTOSTART_SPEED = Number(PLAYTEST_QUERY.get('speed') || '1');

let playtestBot = {
    active: false,
    timeScale: 1,
    route: null,
    routeIndex: 0,
    objective: null,
    objectiveStartedAt: 0,
    modalContinueDelay: 0,
    sampleTimer: 0,
    uiTimer: 0,
    stuckCounter: 0,
    lastPosition: null,
    recoveryTimer: 0,
    recoveryTarget: null,
    lastMoveTarget: null,
    lastRoutePreview: [],
    lastTargetDoorName: null,
    blockedObjectives: {},
    doorActionCooldown: 0,
    exitIntent: {
        toilet: false,
        relax: false
    },
    telemetry: {
        sessionStartedAt: new Date().toISOString(),
        runs: []
    },
    currentRun: null,
    lastFinishedRun: null,
    panelCollapsed: window.innerWidth <= 900,
    panelUserSet: false
};

window.playtestBot = playtestBot;
window.exportPlaytestData = exportPlaytestData;
window.restartPlaytestRun = restartPlaytestRun;

function resizeCanvasDisplay() {
    const aspect = GAME_WIDTH / GAME_HEIGHT;
    let displayWidth = window.innerWidth;
    let displayHeight = displayWidth / aspect;

    if (displayHeight > window.innerHeight) {
        displayHeight = window.innerHeight;
        displayWidth = displayHeight * aspect;
    }

    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    if (!playtestBot.panelUserSet) {
        playtestBot.panelCollapsed = window.innerWidth <= 900;
    }
    syncPlaytestPanelState();
}

function syncPlaytestPanelState() {
    if (!playtestElements.panel) return;

    const shouldCollapse = playtestBot.panelCollapsed;
    playtestElements.panel.classList.toggle('is-collapsed', shouldCollapse);

    if (playtestElements.collapse) {
        playtestElements.collapse.textContent = shouldCollapse ? 'MORE' : 'LESS';
        playtestElements.collapse.setAttribute('aria-expanded', shouldCollapse ? 'false' : 'true');
        playtestElements.collapse.setAttribute(
            'aria-label',
            shouldCollapse ? 'Expand playtest panel' : 'Collapse playtest panel'
        );
    }
}

function setPlaytestPanelCollapsed(collapsed, userInitiated = false) {
    playtestBot.panelCollapsed = !!collapsed;
    if (userInitiated) {
        playtestBot.panelUserSet = true;
    }
    syncPlaytestPanelState();
}

function setVirtualActionState(action, active) {
    if (action === 'action') {
        if (active) {
            if (!input.actionHeld) {
                input.actionHeld = true;
                input.actionStartTime = Date.now();
            }
        } else if (input.actionHeld) {
            input.actionHeld = false;
            input.action = true;
        }
        return;
    }

    input[action] = active;
}

touchButtons.forEach(button => {
    const action = button.dataset.touch;
    const activate = event => {
        event.preventDefault();
        button.classList.add('active');
        setVirtualActionState(action, true);
    };
    const deactivate = event => {
        event.preventDefault();
        button.classList.remove('active');
        setVirtualActionState(action, false);
    };

    button.addEventListener('pointerdown', activate);
    button.addEventListener('pointerup', deactivate);
    button.addEventListener('pointercancel', deactivate);
    button.addEventListener('pointerleave', event => {
        if (event.pointerType !== 'mouse' || button.classList.contains('active')) {
            deactivate(event);
        }
    });
});

if (playtestElements.toggle) {
    playtestElements.toggle.addEventListener('click', () => togglePlaytestBot());
}
if (playtestElements.speed) {
    playtestElements.speed.addEventListener('click', () => cyclePlaytestSpeed());
}
if (playtestElements.export) {
    playtestElements.export.addEventListener('click', () => exportPlaytestData());
}
if (playtestElements.reset) {
    playtestElements.reset.addEventListener('click', () => restartPlaytestRun());
}
if (playtestElements.collapse) {
    playtestElements.collapse.addEventListener('click', () => {
        setPlaytestPanelCollapsed(!playtestBot.panelCollapsed, true);
    });
}

window.addEventListener('resize', resizeCanvasDisplay);
window.addEventListener('orientationchange', resizeCanvasDisplay);
resizeCanvasDisplay();

// Coordinate offset to convert negative coords to positive
const OFFSET_X = 270;
const OFFSET_Y = 233;

// Define rooms (from House layout.txt)
const RAW_ROOMS = {
    DOG_YARD: { x: -269, y: -233, w: 48, h: 46, name: 'Dog yard', color: '#24cc46' },
    CHICKEN_YARD: { x: -221, y: -233, w: 34, h: 46, name: 'Chicken yard', color: '#24cc46' },
    SHED: { x: -202, y: -232, w: 14, h: 8, name: 'Shed', color: '#b0b0b0' },
    CHICKEN_RUN: { x: -198, y: -212, w: 9, h: 20, name: 'Chicken run', color: '#b0b0b0' },
    CHICKEN_COOP: { x: -195, y: -200, w: 4, h: 2, name: 'Chicken coop', color: '#369b4a' },
    LIVING_ROOM: { x: -241, y: -226, w: 20, h: 27, name: 'Living room', color: '#363d9b' },
    KITCHEN: { x: -249, y: -226, w: 8, h: 15, name: 'Kitchen', color: '#ffffff' },
    READING__DOG_ROOM: { x: -256, y: -226, w: 7, h: 15, name: 'Reading / dog room', color: '#fe7c7c' },
    BABYS_ROOM: { x: -256, y: -209, w: 15, h: 10, name: "Baby's room", color: '#fe7cf9' },
    MASTER_BEDROOM: { x: -264, y: -217, w: 8, h: 18, name: 'Master bedroom', color: '#aea8ff' },
    ENSUITE: { x: -264, y: -226, w: 8, h: 9, name: 'Ensuite', color: '#6a5ffc' },
    HOUSEMATE_ROOM: { x: -221, y: -219, w: 11, h: 7, name: "Housemate's room", color: '#78ff75' },
    HOME_OFFICE: { x: -221, y: -210, w: 5, h: 11, name: 'Home office', color: '#7ceffe' },
    SPARE_ROOM: { x: -216, y: -210, w: 6, h: 11, name: 'Spare room', color: '#a86161' },
    CORRIDOR_RIGHT: { x: -221, y: -212, w: 11, h: 2, name: 'Corridor (right)', color: '#f7ca50' },
    CORRIDOR_LEFT: { x: -256, y: -211, w: 15, h: 2, name: 'Corridor (left)', color: '#f7ca50' },
    PATIO_MAIN: { x: -221, y: -226, w: 15, h: 7, name: 'Patio', color: '#fff475' },
    PATIO_STRIP: { x: -210, y: -219, w: 4, h: 20, name: 'Patio strip', color: '#fff475' },
    DOG_PATIO: { x: -264, y: -199, w: 43, h: 5, name: 'Dog patio', color: '#eef58e' },
};

const ROOMS = {};
for (const k of Object.keys(RAW_ROOMS)) {
    const r = RAW_ROOMS[k];
    ROOMS[k] = { x: r.x + OFFSET_X, y: r.y + OFFSET_Y, w: r.w, h: r.h, name: r.name, color: r.color };
}

const OUTDOOR_LAYOUT = {
    SPRINKLER: {
        x: ROOMS.DOG_YARD.x + 15,
        y: ROOMS.DOG_YARD.y + 4,
        rawX: RAW_ROOMS.DOG_YARD.x + 15,
        rawY: RAW_ROOMS.DOG_YARD.y + 4
    },
    MOWER: { x: (ROOMS.DOG_YARD.x + 10) * TILE_SIZE, y: (ROOMS.DOG_YARD.y + 5) * TILE_SIZE }
};

const ROOM_WAYPOINT_OVERRIDES = {
    DOG_YARD: { x: RAW_ROOMS.DOG_YARD.x + 3, y: RAW_ROOMS.DOG_YARD.y + 20 },
    CHICKEN_YARD: { x: RAW_ROOMS.CHICKEN_YARD.x + 22, y: RAW_ROOMS.CHICKEN_YARD.y + 20 },
    HOUSEMATE_ROOM: { x: RAW_ROOMS.HOUSEMATE_ROOM.x + 4.8, y: RAW_ROOMS.HOUSEMATE_ROOM.y + 4.8 },
    SPARE_ROOM: { x: RAW_ROOMS.SPARE_ROOM.x + 3.0, y: RAW_ROOMS.SPARE_ROOM.y + 6.2 },
    DOG_PATIO: { x: RAW_ROOMS.DOG_PATIO.x + 16.0, y: RAW_ROOMS.DOG_PATIO.y + 3.2 }
};

const RAW_WALLS = [
    // Yards
    { x: -269, y: -233, w: 48, h: 0.3 }, { x: -269, y: -187.3, w: 48, h: 0.3 }, { x: -269, y: -233, w: 0.3, h: 46 }, { x: -221.3, y: -233, w: 0.3, h: 3 }, { x: -221.3, y: -227.5, w: 0.3, h: 34.5 }, { x: -221.3, y: -190.5, w: 0.3, h: 0.2 },
    { x: -221, y: -233, w: 34, h: 0.3 }, { x: -221, y: -187.3, w: 34, h: 0.3 }, { x: -187.3, y: -233, w: 0.3, h: 46 },
    { x: -202, y: -232, w: 14, h: 0.3 }, { x: -202, y: -232, w: 0.3, h: 8 }, { x: -188.3, y: -232, w: 0.3, h: 8 },
    { x: -198, y: -212, w: 9, h: 0.3 }, { x: -198, y: -192.3, w: 9, h: 0.3 }, { x: -198, y: -212, w: 0.3, h: 20 }, { x: -189.3, y: -212, w: 0.3, h: 20 },
    { x: -195, y: -200, w: 4, h: 0.3 }, { x: -195, y: -198.3, w: 4, h: 0.3 }, { x: -195, y: -200, w: 0.3, h: 2 }, { x: -191.3, y: -200, w: 0.3, h: 2 },
    // Living room
    { x: -241, y: -226, w: 20, h: 0.3 }, { x: -241, y: -199.3, w: 20, h: 0.3 }, { x: -241, y: -226, w: 0.3, h: 27 }, { x: -221.3, y: -226, w: 0.3, h: 27 },
    // Patios
    { x: -221, y: -219.3, w: 15, h: 0.3 },
    { x: -210, y: -219, w: 4, h: 0.3 }, { x: -210, y: -219, w: 0.3, h: 20 },
    // Housemate
    { x: -221, y: -219, w: 11, h: 0.3 }, { x: -221, y: -212.3, w: 11, h: 0.3 }, { x: -221, y: -219, w: 0.3, h: 7 }, { x: -210.3, y: -219, w: 0.3, h: 7 },
    // Corridors
    { x: -221, y: -212, w: 11, h: 0.3 }, { x: -221, y: -210.3, w: 11, h: 0.3 }, { x: -221, y: -212, w: 0.3, h: 2 }, { x: -210.3, y: -212, w: 0.3, h: 2 },
    { x: -256, y: -211, w: 15, h: 0.3 }, { x: -256, y: -209.3, w: 15, h: 0.3 }, { x: -256, y: -211, w: 0.3, h: 2 }, { x: -241.3, y: -211, w: 0.3, h: 2 },
    // Kitchen
    { x: -249, y: -226, w: 8, h: 0.3 }, { x: -249, y: -211.3, w: 8, h: 0.3 }, { x: -249, y: -226, w: 0.3, h: 15 }, { x: -241.3, y: -226, w: 0.3, h: 15 },
    // Reading
    { x: -256, y: -226, w: 7, h: 0.3 }, { x: -256, y: -211.3, w: 7, h: 0.3 }, { x: -256, y: -226, w: 0.3, h: 15 }, { x: -249.3, y: -226, w: 0.3, h: 15 },
    // Baby
    { x: -256, y: -209, w: 15, h: 0.3 }, { x: -256, y: -199.3, w: 15, h: 0.3 }, { x: -256, y: -209, w: 0.3, h: 10 }, { x: -241.3, y: -209, w: 0.3, h: 10 },
    // Office
    { x: -221, y: -210, w: 5, h: 0.3 }, { x: -221, y: -199.3, w: 5, h: 0.3 }, { x: -221, y: -210, w: 0.3, h: 11 }, { x: -216.3, y: -210, w: 0.3, h: 11 },
    // Spare
    { x: -216, y: -210, w: 6, h: 0.3 }, { x: -216, y: -199.3, w: 6, h: 0.3 }, { x: -216, y: -210, w: 0.3, h: 11 }, { x: -210.3, y: -210, w: 0.3, h: 11 },
    // Master/Ensuite
    { x: -264, y: -217, w: 8, h: 0.3 }, { x: -264, y: -199.3, w: 8, h: 0.3 }, { x: -264, y: -217, w: 0.3, h: 18 }, { x: -256.3, y: -217, w: 0.3, h: 18 },
    { x: -264, y: -226, w: 8, h: 0.3 }, { x: -264, y: -217.3, w: 8, h: 0.3 }, { x: -264, y: -226, w: 0.3, h: 9 }, { x: -256.3, y: -226, w: 0.3, h: 9 },
    // Dog patio (top wall only — open to lawn on bottom and sides)
    { x: -264, y: -199, w: 43, h: 0.3 },
];

const WALLS = [];
for (const w of RAW_WALLS) {
    WALLS.push({ x: w.x + OFFSET_X, y: w.y + OFFSET_Y, w: w.w, h: w.h });
}

const RAW_DOORS = [
    { x: -262.0, y: -217.8, w: 2.0, h: 2.0, orient: 'h', name: 'Ensuite → Master Bedroom', open: true },
    { x: -256.15, y: -211.6, w: 0.3, h: 3.2, orient: 'v', name: 'Master Bedroom → Corridor (left)', open: true },
    { x: -254.2, y: -211.3, w: 2.4, h: 0.3, orient: 'h', name: 'Reading → Corridor (left)', open: true },
    { x: -246.6, y: -211.3, w: 2.4, h: 0.3, orient: 'h', name: 'Kitchen → Corridor (left)', open: true },
    { x: -249.9, y: -209.3, w: 2.4, h: 0.3, orient: 'h', name: 'Baby → Corridor (left)', open: true },
    { x: -241.15, y: -211.6, w: 0.3, h: 3.2, orient: 'v', name: 'Corridor (left) → Living', open: true },
    { x: -241.15, y: -220.3, w: 0.3, h: 3.8, orient: 'v', name: 'Kitchen → Living', open: true },
    { x: -221.15, y: -212.6, w: 0.3, h: 3.2, orient: 'v', name: 'Living → Corridor (right)', open: true },
    { x: -218.8, y: -212.15, w: 3.1, h: 0.3, orient: 'h', name: 'Corridor (right) → Housemate', open: true },
    { x: -220.5, y: -210.15, w: 2.8, h: 0.3, orient: 'h', name: 'Corridor (right) → Office', open: true },
    { x: -214.5, y: -210.15, w: 2.9, h: 0.3, orient: 'h', name: 'Corridor (right) → Spare', open: true },
    { x: -221.15, y: -224.5, w: 0.3, h: 3.2, orient: 'v', name: 'Living → Patio', open: true },
    { x: -210.15, y: -212.6, w: 0.3, h: 3.2, orient: 'v', name: 'Corridor (right) → Patio strip', open: true },
    { x: -234.6, y: -199.15, w: 3.2, h: 0.3, orient: 'h', name: 'Living → Dog patio', open: true },
    { x: -262.8, y: -199.15, w: 2.8, h: 0.3, orient: 'h', name: 'Master → Dog patio', open: true },
    { x: -202.0, y: -225.0, w: 14.0, h: 2.0, orient: 'h', name: 'Yard → Shed', open: false },
    { x: -195.0, y: -199.0, w: 2.0, h: 2.0, orient: 'h', name: 'Run → Coop', open: true },
    { x: -199.0, y: -206.0, w: 2.0, h: 7.0, orient: 'v', name: 'Yard → Chicken run (gate)', open: true },
    { x: -221.7, y: -230.0, w: 1.0, h: 2.5, orient: 'v', name: 'Dog Yard → Chicken Yard (top gate)', open: false },
    { x: -221.7, y: -193.0, w: 1.0, h: 5.0, orient: 'v', name: 'Dog Yard → Chicken Yard (bottom gate)', open: false },
];

const DOORS = [];
for (const d of RAW_DOORS) {
    DOORS.push({ x: d.x + OFFSET_X, y: d.y + OFFSET_Y, w: d.w, h: d.h, orient: d.orient || 'h', name: d.name, open: d.open });
}

function createWorldObject(roomKey, dx, dy, w, h, options = {}) {
    const room = RAW_ROOMS[roomKey];
    return { x: room.x + dx, y: room.y + dy, w, h, ...options };
}

function getRawDoorCenter(name) {
    const door = RAW_DOORS.find(d => d.name === name);
    if (!door) {
        throw new Error(`Missing door waypoint source: ${name}`);
    }
    return { x: door.x + door.w / 2, y: door.y + door.h / 2 };
}

function makeDoorWaypoint(name, connections) {
    return { ...getRawDoorCenter(name), connections, rooms: connections.slice() };
}

function makeRoomWaypoint(roomKey, connections) {
    const room = RAW_ROOMS[roomKey];
    const override = ROOM_WAYPOINT_OVERRIDES[roomKey];
    const x = override ? override.x : room.x + room.w / 2;
    const y = override ? override.y : room.y + room.h / 2;
    return { x, y, connections, rooms: [roomKey] };
}

function makeWaypoint(x, y, connections, rooms = []) {
    return { x, y, connections, rooms };
}

// --- NAVIGATION GRAPH ---
const NAV_GRAPH = {
    'LIVING_ROOM': { connections: ['Kitchen → Living', 'Corridor (left) → Living', 'Living → Corridor (right)', 'Living → Patio', 'Living → Dog patio'] },
    'KITCHEN': { connections: ['Kitchen → Living', 'Kitchen → Corridor (left)'] },
    'CORRIDOR_LEFT': { connections: ['Corridor (left) → Living', 'Master Bedroom → Corridor (left)', 'Reading → Corridor (left)', 'Kitchen → Corridor (left)', 'Baby → Corridor (left)'] },
    'CORRIDOR_RIGHT': { connections: ['Living → Corridor (right)', 'Corridor (right) → Housemate', 'Corridor (right) → Office', 'Corridor (right) → Spare', 'Corridor (right) → Patio strip'] },
    'MASTER_BEDROOM': { connections: ['Master Bedroom → Corridor (left)', 'Ensuite → Master Bedroom', 'Master → Dog patio'] },
    'BABYS_ROOM': { connections: ['Baby → Corridor (left)'] },
    'READING__DOG_ROOM': { connections: ['Reading → Corridor (left)'] },
    'ENSUITE': { connections: ['Ensuite → Master Bedroom'] },
    'HOUSEMATE_ROOM': { connections: ['Corridor (right) → Housemate'] },
    'HOME_OFFICE': { connections: ['Corridor (right) → Office'] },
    'SPARE_ROOM': { connections: ['Corridor (right) → Spare'] },
    'DOG_YARD': { connections: ['Yard → Shed', 'Yard → Chicken run', 'Yard → Chicken run (gate)'] },
    'PATIO_MAIN': { connections: ['Living → Patio'] },
    'PATIO_STRIP': { connections: ['Corridor (right) → Patio strip'] },
    'DOG_PATIO': { connections: ['Living → Dog patio', 'Master → Dog patio'] },
    'SHED': { connections: ['Yard → Shed'] },
    'CHICKEN_RUN': { connections: ['Yard → Chicken run', 'Yard → Chicken run (gate)', 'Run → Coop'] },
    'CHICKEN_COOP': { connections: ['Run → Coop'] }
};

// Map doors to the graph
for (const d of DOORS) {
    if (NAV_GRAPH[d.name]) continue;
    const parts = d.name.split(' → ');
    NAV_GRAPH[d.name] = { isDoor: true, x: (d.x + d.w / 2) * TILE_SIZE, y: (d.y + d.h / 2) * TILE_SIZE, rooms: [] };
}
const ROOM_MAP = { 'Kitchen': 'KITCHEN', 'Living': 'LIVING_ROOM', 'Corridor (left)': 'CORRIDOR_LEFT', 'Corridor (right)': 'CORRIDOR_RIGHT', 'Master Bedroom': 'MASTER_BEDROOM', 'Baby': 'BABYS_ROOM', 'Reading': 'READING__DOG_ROOM', 'Ensuite': 'ENSUITE', 'Housemate': 'HOUSEMATE_ROOM', 'Office': 'HOME_OFFICE', 'Spare': 'SPARE_ROOM', 'Patio': 'PATIO_MAIN', 'Patio strip': 'PATIO_STRIP', 'Dog patio': 'DOG_PATIO', 'Yard': 'DOG_YARD', 'Shed': 'SHED', 'Chicken run': 'CHICKEN_RUN', 'Coop': 'CHICKEN_COOP', 'Run': 'CHICKEN_RUN', 'Master': 'MASTER_BEDROOM' };
for (const [doorName, node] of Object.entries(NAV_GRAPH)) {
    if (!node.isDoor) continue;
    const parts = doorName.split(' → ');
    node.rooms = parts.map(p => ROOM_MAP[p.trim()]).filter(p => p);
}

const POIS = {
    COUCH: { x: ROOMS.LIVING_ROOM.x + 8, y: ROOMS.LIVING_ROOM.y + 12, type: 'relax', name: 'Couch', room: 'LIVING_ROOM' },
    SINK: { x: ROOMS.KITCHEN.x + 3, y: ROOMS.KITCHEN.y + 8, type: 'dishes', name: 'Sink', room: 'KITCHEN' },
    TOY_BOX: { x: ROOMS.SPARE_ROOM.x + 2, y: ROOMS.SPARE_ROOM.y + 6, type: 'deposit', name: 'Toy Box', room: 'SPARE_ROOM' },
    PATIO: { x: ROOMS.PATIO_MAIN.x + 8, y: ROOMS.PATIO_MAIN.y + 3, type: 'coverage', name: 'Patio', room: 'PATIO_MAIN' },
    BEER: { x: ROOMS.SHED.x + 8, y: ROOMS.SHED.y + 3, type: 'fetch', name: 'Beer', room: 'SHED' },
    SPRINKLER: { x: OUTDOOR_LAYOUT.SPRINKLER.x, y: OUTDOOR_LAYOUT.SPRINKLER.y, type: 'coverage', name: 'Sprinkler', room: 'DOG_YARD' },
    VACUUM: { x: ROOMS.CORRIDOR_RIGHT.x + 5, y: ROOMS.CORRIDOR_RIGHT.y + 1, type: 'tool', name: 'Vacuum', room: 'CORRIDOR_RIGHT' },
    BED: { x: ROOMS.MASTER_BEDROOM.x + 4, y: ROOMS.MASTER_BEDROOM.y + 10, type: 'relax', name: 'Bed', room: 'MASTER_BEDROOM' },
    BABY_COT: { x: ROOMS.BABYS_ROOM.x + 8, y: ROOMS.BABYS_ROOM.y + 4, type: 'hold', name: 'Baby', room: 'BABYS_ROOM' },
    CHICKEN_FEEDER: { x: ROOMS.CHICKEN_YARD.x + 20, y: ROOMS.CHICKEN_YARD.y + 20, type: 'fetch', name: 'Chicken Feed', room: 'CHICKEN_YARD' },
    CHICKEN_RUN: { x: ROOMS.CHICKEN_RUN.x + 4, y: ROOMS.CHICKEN_RUN.y + 10, type: 'fetch', name: 'Chicken Run', room: 'CHICKEN_RUN' },
    DOG_BOWLS: { x: ROOMS.DOG_PATIO.x + 30 - 20, y: ROOMS.DOG_PATIO.y + 2, type: 'fetch', name: 'Dog Bowls', room: 'DOG_PATIO' }
};

const WORLD_OBJECTS = {
    COUCH: createWorldObject('LIVING_ROOM', 2.5, 13.0, 6.5, 3.0, { color: '#6d4c41', accent: '#8d6e63', type: 'relax' }),
    ARMCHAIR: createWorldObject('LIVING_ROOM', 11.5, 11.5, 3.5, 3.5, { color: '#8d6e63', accent: '#bcaaa4', type: 'decor' }),
    COFFEE_TABLE: createWorldObject('LIVING_ROOM', 10.5, 15.0, 4.0, 2.0, { color: '#8d6e63', accent: '#d7ccc8', type: 'decor' }),
    TV_UNIT: createWorldObject('LIVING_ROOM', 17.0, 8.0, 1.5, 7.0, { color: '#263238', accent: '#546e7a', type: 'decor' }),
    BOOKSHELF_LIVING: createWorldObject('LIVING_ROOM', 1.0, 2.0, 1.5, 8.0, { color: '#795548', accent: '#a1887f', type: 'decor' }),
    KITCHEN_COUNTER: createWorldObject('KITCHEN', 0.7, 1.2, 6.2, 1.4, { color: '#b0bec5', accent: '#eceff1', type: 'decor' }),
    KITCHEN_ISLAND: createWorldObject('KITCHEN', 1.5, 9.5, 4.0, 2.0, { color: '#90a4ae', accent: '#cfd8dc', type: 'decor' }),
    FRIDGE: createWorldObject('KITCHEN', 6.2, 2.5, 1.2, 3.2, { color: '#cfd8dc', accent: '#90a4ae', type: 'decor' }),
    SINK_UNIT: createWorldObject('KITCHEN', 0.8, 12.0, 5.8, 1.3, { color: '#90a4ae', accent: '#eceff1', type: 'decor' }),
    COFFEE_MACHINE: createWorldObject('KITCHEN', 5.2, 3.2, 1.2, 1.1, { color: '#4e342e', accent: '#cfd8dc', type: 'hold_refill' }),
    READING_CHAIR: createWorldObject('READING__DOG_ROOM', 1.0, 2.0, 3.0, 3.5, { color: '#8d6e63', accent: '#bcaaa4', type: 'decor' }),
    DOG_BED_READING: createWorldObject('READING__DOG_ROOM', 1.0, 9.5, 3.5, 2.5, { color: '#5d4037', accent: '#8d6e63', type: 'decor' }),
    BOOKSHELF_READING: createWorldObject('READING__DOG_ROOM', 5.2, 2.0, 1.2, 8.5, { color: '#6d4c41', accent: '#a1887f', type: 'decor' }),
    BABY_COT_OBJECT: createWorldObject('BABYS_ROOM', 7.5, 2.0, 4.5, 2.8, { color: '#f8bbd0', accent: '#ffffff', type: 'decor' }),
    CHANGE_TABLE: createWorldObject('BABYS_ROOM', 1.2, 2.0, 3.0, 1.8, { color: '#ce93d8', accent: '#f3e5f5', type: 'decor' }),
    NURSERY_DRESSER: createWorldObject('BABYS_ROOM', 1.2, 6.2, 4.2, 1.8, { color: '#bcaaa4', accent: '#efebe9', type: 'decor' }),
    PLAY_MAT: createWorldObject('BABYS_ROOM', 9.2, 6.0, 4.2, 2.5, { color: '#ffcc80', accent: '#fff3e0', type: 'decor' }),
    BED: createWorldObject('MASTER_BEDROOM', 1.0, 7.0, 6.0, 6.5, { color: '#5c6bc0', accent: '#c5cae9', type: 'relax' }),
    WARDROBE: createWorldObject('MASTER_BEDROOM', 0.8, 1.0, 2.0, 4.2, { color: '#6d4c41', accent: '#a1887f', type: 'decor' }),
    DRESSER: createWorldObject('MASTER_BEDROOM', 3.8, 1.4, 3.0, 1.6, { color: '#8d6e63', accent: '#d7ccc8', type: 'decor' }),
    TOILET: createWorldObject('ENSUITE', 1.2, 5.2, 1.6, 2.2, { color: '#eceff1', accent: '#ffffff', type: 'hide' }),
    VANITY: createWorldObject('ENSUITE', 1.0, 1.1, 2.6, 1.3, { color: '#90a4ae', accent: '#eceff1', type: 'decor' }),
    SHOWER: createWorldObject('ENSUITE', 4.2, 1.0, 2.7, 3.0, { color: '#80deea', accent: '#e0f7fa', type: 'decor' }),
    HOUSEMATE_BED: createWorldObject('HOUSEMATE_ROOM', 0.8, 1.0, 4.5, 3.0, { color: '#81c784', accent: '#c8e6c9', type: 'decor' }),
    HOUSEMATE_DESK: createWorldObject('HOUSEMATE_ROOM', 6.0, 1.0, 3.4, 1.8, { color: '#8d6e63', accent: '#d7ccc8', type: 'decor' }),
    HOUSEMATE_WARDROBE: createWorldObject('HOUSEMATE_ROOM', 9.2, 2.5, 1.0, 3.5, { color: '#6d4c41', accent: '#a1887f', type: 'decor' }),
    OFFICE_DESK: createWorldObject('HOME_OFFICE', 0.5, 1.1, 3.8, 1.7, { color: '#8d6e63', accent: '#d7ccc8', type: 'decor' }),
    OFFICE_CHAIR: createWorldObject('HOME_OFFICE', 1.7, 3.1, 1.4, 1.4, { color: '#607d8b', accent: '#b0bec5', type: 'decor' }),
    OFFICE_SHELF: createWorldObject('HOME_OFFICE', 0.5, 6.3, 1.1, 3.6, { color: '#6d4c41', accent: '#a1887f', type: 'decor' }),
    SPARE_BED: createWorldObject('SPARE_ROOM', 2.0, 1.0, 3.2, 4.2, { color: '#a1887f', accent: '#d7ccc8', type: 'decor' }),
    STORAGE_SHELF: createWorldObject('SPARE_ROOM', 0.4, 1.0, 1.0, 5.0, { color: '#6d4c41', accent: '#a1887f', type: 'decor' }),
    TOY_BOX: createWorldObject('SPARE_ROOM', 1.0, 7.0, 3.2, 2.0, { color: '#fbc02d', accent: '#fff59d', type: 'container' }),
    DOG_BED_PATIO: createWorldObject('DOG_PATIO', 2.0, 1.0, 4.0, 2.0, { color: '#8d6e63', accent: '#bcaaa4', type: 'decor' }),
    DOG_BOWL_STAND: createWorldObject('DOG_PATIO', 30.5, 1.1, 3.2, 1.2, { color: '#90a4ae', accent: '#eceff1', type: 'decor' }),
    SHED_FRIDGE: createWorldObject('SHED', 9.5, 1.2, 3.0, 4.2, { color: '#b0bec5', accent: '#eceff1', type: 'decor' }),
    SHED_SHELF: createWorldObject('SHED', 1.0, 1.0, 3.0, 1.4, { color: '#8d6e63', accent: '#d7ccc8', type: 'decor' })
};

// Sprite Cache - stores loaded character images
let spriteCache = {
    dad: null,
    wife: null,
    housemate: null,
    baby: null,
    brownDog: null,
    blackDog: null,
    munty: null,
    aylin: null,
    morticia: null,
    wednesday: null,
    morag: null,
    martha: null,
    fallbackLoaded: false
};

// Load all character sprites from assets
function loadSprites() {
    const spritePath = 'Sprites and art/Pixel art sprites/';
    const spriteFiles = {
        dad: 'DAD.png',
        wife: 'wife.png',
        housemate: 'jake2.png',
        baby: 'baby.png',
        brownDog: 'momo.png',
        blackDog: 'Piper.png',
        munty: 'Munty.png',
        aylin: 'Aylin.png',
        morticia: 'Morticia.png',
        wednesday: 'Wednesday.png',
        morag: 'morag.png',
        martha: 'martha.png'
    };

    let loadedCount = 0;
    let totalCount = Object.keys(spriteFiles).length;

    for (const [key, filename] of Object.entries(spriteFiles)) {
        const img = new Image();
        img.onload = () => {
            spriteCache[key] = img;
            loadedCount++;
            console.log(`Loaded sprite: ${key} (${loadedCount}/${totalCount})`);
        };
        img.onerror = () => {
            console.warn(`Failed to load sprite: ${key} (${spritePath}${filename})`);
            spriteCache[key] = null;
            loadedCount++;
        };
        img.src = spritePath + filename;
    }

    spriteCache.fallbackLoaded = true;
    console.log(`Starting sprite load. Total sprites to load: ${totalCount}`);
}

// Game State (defined after ROOMS/POIS so we can reference them)
let gameState = {
    day: 1,
    time: 0,
    timePerDay: 300,
    overstimulation: 0,
    isRunning: true,
    tasks: [],
    dad: { x: (ROOMS.LIVING_ROOM.x + 5) * TILE_SIZE, y: (ROOMS.LIVING_ROOM.y + 8) * TILE_SIZE, width: DAD_HITBOX_SIZE, height: DAD_HITBOX_SIZE, carrying: null },
    npcs: {
        baby: { x: 5, y: 5, width: 25, height: 25, withAdult: true },
        wife: { x: 12, y: 8 },
        housemate: { x: 8, y: 12 },
        brownDog: { x: 9, y: 11 },
        blackDog: { x: 11, y: 11 }
    },
    nextTaskId: 0,
    selectedTaskId: null,
    lastEventTick: 0,
    eventTickInterval: 6.66,
    stats: {
        tasksCompleted: 0,
        peakStimulation: 0,
        daysCompleted: 0
    },
    sprintergyLeft: 100,
    maxSprintEnergy: 100,
    barkCooldown: 0,
    barkCooldownMax: 3,
    coffeeBuff: false,
    coffeeBuffTimer: 0,
    coffeeBuffDuration: 60, // 60 seconds of stress resistance
    isRelaxing: false,
    relaxSpot: null, // Which furniture user is relaxing on
    coffeeProgress: 0,
    coffeeBrewTime: 5, // 5 seconds to brew
    isHidingInToilet: false,
    npcStates: {
        wife: { x: (ROOMS.KITCHEN.x + 2) * TILE_SIZE, y: (ROOMS.KITCHEN.y + 2) * TILE_SIZE, targetRoom: 'KITCHEN', moveSpeed: 37.5, canUseDoors: true, doorInteraction: null, currentPath: [], pathRecalcTimer: 0 },
        housemate: { x: (ROOMS.SPARE_ROOM.x + 2) * TILE_SIZE, y: (ROOMS.SPARE_ROOM.y + 2) * TILE_SIZE, targetRoom: 'SPARE_ROOM', moveSpeed: 30, canUseDoors: true, doorInteraction: null, currentPath: [], pathRecalcTimer: 0 },
        baby: { x: (ROOMS.BABYS_ROOM.x + 4) * TILE_SIZE, y: (ROOMS.BABYS_ROOM.y + 2) * TILE_SIZE, targetRoom: 'BABYS_ROOM', moveSpeed: 22.5, canUseDoors: false, currentPath: [], pathRecalcTimer: 0 },
        brownDog: { x: (ROOMS.LIVING_ROOM.x + 3) * TILE_SIZE, y: (ROOMS.LIVING_ROOM.y + 10) * TILE_SIZE, targetRoom: 'LIVING_ROOM', moveSpeed: 60, canUseDoors: false, currentPath: [], pathRecalcTimer: 0 },
        blackDog: { x: (ROOMS.LIVING_ROOM.x + 5) * TILE_SIZE, y: (ROOMS.LIVING_ROOM.y + 10) * TILE_SIZE, targetRoom: 'LIVING_ROOM', moveSpeed: 67.5, canUseDoors: false, currentPath: [], pathRecalcTimer: 0 },
    },
    doorsOpened: {},
    entities: [],
    chickens: [],
    aggressiveChickens: [],
    audioRings: [],
    notification: null,
    mowedGrass: new Set(),
    mower: null,
    sprinklerMoved: false,
    beerClaimed: false,
    chickensLocked: false,
    sprinklerActive: false,
    directPlayerIntentDoorName: null,
    isHidingInToilet: false,
    cameraScale: 1.0,
    cameraOffsetX: 0,
    cameraOffsetY: 0,
    sprinkler: { x: POIS.SPRINKLER.x * TILE_SIZE, y: POIS.SPRINKLER.y * TILE_SIZE },
    timeline: {
        nextSprinklerIndex: 0,
        activeSprinklerTrigger: null,
        beerTaskSpawned: false,
        chickenCurfewStarted: false
    }
};

// Task Types
class Task {
    constructor(id, type, name, location, duration = 0, progress = 0, maxProgress = 1) {
        this.id = id;
        this.type = type; // 'fetch', 'coverage', 'hold'
        this.name = name;
        this.location = location;
        this.duration = duration; // for hold tasks
        this.progress = progress;
        this.maxProgress = maxProgress;
        this.active = false;
        this.startTime = 0;
    }
}

// Input handling
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    if (playtestBot.active && BOT_CONTROLLED_KEYS.has(key)) {
        return;
    }

    switch (key) {
        case 'w': case 'arrowup': input.up = true; break;
        case 's': case 'arrowdown': input.down = true; break;
        case 'a': case 'arrowleft': input.left = true; break;
        case 'd': case 'arrowright': input.right = true; break;
        case ' ': case 'e':
            if (!input.actionHeld) {
                input.actionHeld = true;
                input.actionStartTime = Date.now();
            }
            break;
        case 'shift': input.sprinting = true; break;
        case 'q': input.bark = true; break;
        case 'r': input.interact = true; break;  // Interact with NPCs
        case 'p': togglePlaytestBot(); break;
        case '[': cyclePlaytestSpeed(); break;
        case ']': exportPlaytestData(); break;
        case '0': restartPlaytestRun(); break;
        case '\\': DEBUG_MODE = !DEBUG_MODE; break;
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();

    if (playtestBot.active && BOT_CONTROLLED_KEYS.has(key)) {
        return;
    }

    switch (key) {
        case 'w': case 'arrowup': input.up = false; break;
        case 's': case 'arrowdown': input.down = false; break;
        case 'a': case 'arrowleft': input.left = false; break;
        case 'd': case 'arrowright': input.right = false; break;
        case ' ': case 'e':
            input.actionHeld = false;
            input.action = true;
            break;
        case 'shift': input.sprinting = false; break;
        case 'q': input.bark = false; break;
        case 'r': input.interact = false; break;
    }
});

// Initialize game
function initGame() {
    if (!spriteCache.fallbackLoaded) {
        loadSprites();
    }

    hideModal();
    clearBotControls();
    activeDialogues = [];
    for (const key of Object.keys(dialogueCooldowns)) {
        dialogueCooldowns[key] = 0;
    }

    gameState.nextTaskId = 0;
    gameState.selectedTaskId = null;
    gameState.lastEventTick = 0;
    gameState.eventTickInterval = 6.66;
    gameState.stats = {
        tasksCompleted: 0,
        peakStimulation: 0,
        daysCompleted: 0
    };
    gameState.tasks = [];
    gameState.entities = [];
    gameState.audioRings = [];
    gameState.overstimulation = 0;
    gameState.time = 0;
    gameState.day = 1;
    gameState.isRunning = true;
    gameState.sprintergyLeft = gameState.maxSprintEnergy;
    gameState.barkCooldown = 0;
    gameState.coffeeBuff = false;
    gameState.coffeeBuffTimer = 0;
    gameState.coffeeProgress = 0;
    gameState.isRelaxing = false;
    gameState.relaxSpot = null;
    gameState.isHidingInToilet = false;
    gameState.cameraScale = 1.0;
    gameState.cameraOffsetX = 0;
    gameState.cameraOffsetY = 0;
    gameState.directPlayerIntentDoorName = null;
    gameState.notification = null;
    gameState.dad.x = (ROOMS.LIVING_ROOM.x + 5) * TILE_SIZE;
    gameState.dad.y = (ROOMS.LIVING_ROOM.y + 8) * TILE_SIZE;
    gameState.dad.width = DAD_HITBOX_SIZE;
    gameState.dad.height = DAD_HITBOX_SIZE;
    gameState.dad.carrying = null;
    gameState.npcStates = {
        wife: { x: (ROOMS.KITCHEN.x + 2) * TILE_SIZE, y: (ROOMS.KITCHEN.y + 2) * TILE_SIZE, targetRoom: 'KITCHEN', moveSpeed: 37.5, canUseDoors: true, doorInteraction: null, currentPath: [], pathRecalcTimer: 0 },
        housemate: { x: (ROOMS.SPARE_ROOM.x + 2) * TILE_SIZE, y: (ROOMS.SPARE_ROOM.y + 2) * TILE_SIZE, targetRoom: 'SPARE_ROOM', moveSpeed: 30, canUseDoors: true, doorInteraction: null, currentPath: [], pathRecalcTimer: 0 },
        baby: { x: (ROOMS.BABYS_ROOM.x + 4) * TILE_SIZE, y: (ROOMS.BABYS_ROOM.y + 2) * TILE_SIZE, targetRoom: 'BABYS_ROOM', moveSpeed: 22.5, canUseDoors: false, currentPath: [], pathRecalcTimer: 0 },
        brownDog: { x: (ROOMS.LIVING_ROOM.x + 3) * TILE_SIZE, y: (ROOMS.LIVING_ROOM.y + 10) * TILE_SIZE, targetRoom: 'LIVING_ROOM', moveSpeed: 60, canUseDoors: false, currentPath: [], pathRecalcTimer: 0 },
        blackDog: { x: (ROOMS.LIVING_ROOM.x + 5) * TILE_SIZE, y: (ROOMS.LIVING_ROOM.y + 10) * TILE_SIZE, targetRoom: 'LIVING_ROOM', moveSpeed: 67.5, canUseDoors: false, currentPath: [], pathRecalcTimer: 0 },
        munty: null
    };
    DOORS.forEach((door, index) => {
        door.open = RAW_DOORS[index].open;
    });
    playtestBot.route = null;
    playtestBot.routeIndex = 0;
    playtestBot.objective = null;
    playtestBot.objectiveStartedAt = 0;
    playtestBot.modalContinueDelay = 0;
    playtestBot.sampleTimer = 0;
    playtestBot.stuckCounter = 0;
    playtestBot.lastPosition = null;
    playtestBot.recoveryTimer = 0;
    playtestBot.recoveryTarget = null;
    playtestBot.lastMoveTarget = null;
    playtestBot.lastRoutePreview = [];
    playtestBot.lastTargetDoorName = null;
    playtestBot.blockedObjectives = {};
    playtestBot.doorActionCooldown = 0;
    playtestBot.exitIntent = { toilet: false, relax: false };

    // Initialize chickens in the chicken run with giant door open
    gameState.chickens = [];
    const chickenNames = ['Aylin', 'Morticia', 'Wednesday'];
    for (let i = 0; i < 3; i++) {
        const pos = randomPointInRoom('CHICKEN_RUN');
        gameState.chickens.push({
            x: pos.x, y: pos.y,
            moveSpeed: 40 + Math.random() * 10,
            state: 'flock',
            stateTimer: 0,
            isLeader: i === 0,
            aggressive: false,
            poopTimer: 8 + Math.random() * 12,
            targetX: pos.x, targetY: pos.y,
            fleeTimer: 0,
            name: chickenNames[i]
        });
    }
    gameState.aggressiveChickens = [];

    // Open the giant gate to chicken run
    const giantGate = DOORS.find(d => d.name === 'Yard → Chicken run (gate)');
    if (giantGate) giantGate.open = true;
    resetDayFlags();
    resetMowerState();

    // Generate initial tasks
    addInitialTasks();
    lastTime = 0;

    if (playtestBot.active) {
        startPlaytestRun('restart');
    } else {
        updatePlaytestUI();
    }
}

function addInitialTasks() {
    // Dynamic tasks will be generated procedurally throughout the day
    // Start with empty task list - tasks spawn via events
    gameState.tasks = [];

    // ADD TEST ITEMS FOR PLAYTESTING
    if (gameState.day === 1) {
        // Add test poop and toys to living room
        gameState.entities.push(
            { type: 'poop', x: (ROOMS.LIVING_ROOM.x + 3) * TILE_SIZE, y: (ROOMS.LIVING_ROOM.y + 8) * TILE_SIZE },
            { type: 'poop', x: (ROOMS.LIVING_ROOM.x + 10) * TILE_SIZE, y: (ROOMS.LIVING_ROOM.y + 12) * TILE_SIZE },
            { type: 'toy', x: (ROOMS.LIVING_ROOM.x + 6) * TILE_SIZE, y: (ROOMS.LIVING_ROOM.y + 6) * TILE_SIZE },
            { type: 'toy', x: (ROOMS.LIVING_ROOM.x + 12) * TILE_SIZE, y: (ROOMS.LIVING_ROOM.y + 18) * TILE_SIZE }
        );
    }
}

function resetDayFlags() {
    gameState.notification = null;
    gameState.sprinklerMoved = false;
    gameState.sprinklerActive = false;
    gameState.beerClaimed = false;
    gameState.chickensLocked = false;
    gameState.sprinkler.x = POIS.SPRINKLER.x * TILE_SIZE;
    gameState.sprinkler.y = POIS.SPRINKLER.y * TILE_SIZE;
    gameState.timeline = {
        nextSprinklerIndex: 0,
        activeSprinklerTrigger: null,
        beerTaskSpawned: false,
        chickenCurfewStarted: false
    };
}

function resetMowerState() {
    gameState.dad.carrying = null;
    gameState.mowedGrass = new Set();
    gameState.mower = {
        x: OUTDOOR_LAYOUT.MOWER.x,
        y: OUTDOOR_LAYOUT.MOWER.y,
        width: 34,
        height: 18
    };
}

function hideModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function isModalVisible() {
    const modal = document.getElementById('modal');
    return !!modal && modal.style.display === 'flex';
}

function clearBotControls() {
    input.up = false;
    input.down = false;
    input.left = false;
    input.right = false;
    input.action = false;
    input.actionHeld = false;
    input.sprinting = false;
    input.bark = false;
    input.interact = false;
}

function getWorldObjectCenter(key) {
    const obj = WORLD_OBJECTS[key];
    if (!obj) return null;
    return {
        x: (obj.x + OFFSET_X + obj.w / 2) * TILE_SIZE,
        y: (obj.y + OFFSET_Y + obj.h / 2) * TILE_SIZE
    };
}

function getCoffeeInteractionPoint() {
    const coffee = WORLD_OBJECTS.COFFEE_MACHINE;
    if (!coffee) return null;

    return {
        x: Math.round((coffee.x + OFFSET_X + coffee.w / 2) * TILE_SIZE),
        y: Math.round((coffee.y + OFFSET_Y + coffee.h + 1.8) * TILE_SIZE)
    };
}

function getDoorCenter(door) {
    return {
        x: (door.x + door.w / 2) * TILE_SIZE,
        y: (door.y + door.h / 2) * TILE_SIZE
    };
}

function getDistanceToRectPoint(px, py, rect) {
    const dx = Math.max(rect.x - px, 0, px - (rect.x + rect.w));
    const dy = Math.max(rect.y - py, 0, py - (rect.y + rect.h));
    return Math.hypot(dx, dy);
}

function getDoorForWaypointName(waypointName) {
    if (!waypointName || (!waypointName.startsWith('DOOR_') && !waypointName.startsWith('GATE_'))) {
        return null;
    }

    const waypoint = WAYPOINTS[waypointName];
    if (!waypoint) return null;

    let closestDoor = null;
    let closestDist = 36;
    for (const door of DOORS) {
        const center = getDoorCenter(door);
        const dist = Math.hypot(center.x - waypoint.pixelX, center.y - waypoint.pixelY);
        if (dist < closestDist) {
            closestDist = dist;
            closestDoor = door;
        }
    }

    return closestDoor;
}

function describePlaytestWaypoint(waypointName) {
    if (!waypointName) return 'Direct';

    const door = getDoorForWaypointName(waypointName);
    if (door) return door.name;
    if (ROOMS[waypointName]) return ROOMS[waypointName].name;

    return waypointName.replace(/_/g, ' ');
}

function getPlaytestDebugSnapshot() {
    if (typeof gameState === 'undefined') return null;

    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    const roomKey = getRoomAt(dadCenterX, dadCenterY);
    const nearbyDoor = findNearbyDoor();
    const nearbyTask = findNearbyTask();
    const targetDoor = playtestBot.lastMoveTarget ? getDoorForWaypointName(playtestBot.lastMoveTarget.waypointName) : null;
    const objective = playtestBot.objective ? {
        label: playtestBot.objective.label,
        type: playtestBot.objective.type,
        targetX: Math.round(playtestBot.objective.targetX),
        targetY: Math.round(playtestBot.objective.targetY),
        distance: Math.round(Math.hypot(playtestBot.objective.targetX - dadCenterX, playtestBot.objective.targetY - dadCenterY))
    } : null;

    return {
        room: roomKey ? ROOMS[roomKey].name : 'Unknown',
        position: {
            x: Math.round(gameState.dad.x),
            y: Math.round(gameState.dad.y),
            centerX: Math.round(dadCenterX),
            centerY: Math.round(dadCenterY)
        },
        objective,
        nextMove: playtestBot.lastMoveTarget ? {
            label: describePlaytestWaypoint(playtestBot.lastMoveTarget.waypointName),
            x: Math.round(playtestBot.lastMoveTarget.x),
            y: Math.round(playtestBot.lastMoveTarget.y)
        } : null,
        route: playtestBot.route ? playtestBot.route.waypoints.slice(playtestBot.routeIndex, playtestBot.routeIndex + 5).map(describePlaytestWaypoint) : [],
        targetDoor: targetDoor ? { name: targetDoor.name, open: targetDoor.open } : null,
        nearbyDoor: nearbyDoor ? { name: nearbyDoor.name, open: nearbyDoor.open } : null,
        nearbyTask: nearbyTask ? {
            name: nearbyTask.name,
            location: nearbyTask.location,
            type: nearbyTask.type,
            progress: Number((nearbyTask.progress || 0).toFixed(1)),
            maxProgress: nearbyTask.maxProgress || 0
        } : null,
        recovery: playtestBot.recoveryTimer > 0 && playtestBot.recoveryTarget ? {
            timeLeft: Number(playtestBot.recoveryTimer.toFixed(2)),
            x: Math.round(playtestBot.recoveryTarget.x),
            y: Math.round(playtestBot.recoveryTarget.y)
        } : null,
        stuckCounter: playtestBot.stuckCounter
    };
}

function buildPlaytestExportPayload() {
    const payload = {
        exportedAt: new Date().toISOString(),
        version: 'playtest-bot-v1',
        sessionStartedAt: playtestBot.telemetry.sessionStartedAt,
        active: playtestBot.active,
        timeScale: playtestBot.timeScale,
        snapshot: getPlaytestDebugSnapshot(),
        runs: playtestBot.telemetry.runs.slice()
    };

    if (playtestBot.currentRun) {
        payload.currentRun = {
            runId: playtestBot.currentRun.runId,
            startedAt: playtestBot.currentRun.startedAt,
            day: gameState.day,
            time: Number(gameState.time.toFixed(2)),
            events: playtestBot.currentRun.events.slice(),
            samples: playtestBot.currentRun.samples.slice(),
            completedTasks: playtestBot.currentRun.completedTasks.slice(),
            spawnedTasks: playtestBot.currentRun.spawnedTasks.slice()
        };
    }

    return payload;
}

function formatPlaytestEvent(event) {
    const stamp = `${event.time.toFixed(1)}s`;

    switch (event.type) {
        case 'objective':
            return `${stamp} objective: ${event.label}`;
        case 'task_spawned':
            return `${stamp} task+: ${event.name} @ ${event.location}`;
        case 'task_completed':
            return `${stamp} task done: ${event.name}`;
        case 'door_toggled':
            return `${stamp} door: ${event.name} ${event.open ? 'open' : 'closed'}`;
        case 'stuck':
            return `${stamp} stuck#${event.count}: ${event.objective}${event.x !== undefined ? ` @ ${event.x},${event.y}` : ''}`;
        case 'recovery':
            return `${stamp} recovery -> ${event.x},${event.y}`;
        case 'objective_blocked':
            return `${stamp} blocked: ${event.label}`;
        case 'bark':
            return `${stamp} bark`;
        case 'toilet_enter':
            return `${stamp} toilet enter`;
        case 'toilet_exit':
            return `${stamp} toilet exit`;
        case 'relax_exit':
            return `${stamp} relax exit`;
        case 'day_completed':
            return `${stamp} day clear`;
        case 'run_started':
            return `${stamp} run start (${event.source})`;
        default:
            return `${stamp} ${event.type}`;
    }
}

function updatePlaytestUI() {
    if (!playtestElements.panel) return;

    const latestRun = playtestBot.currentRun || playtestBot.lastFinishedRun;
    const objectiveLabel = playtestBot.objective ? playtestBot.objective.label : 'Idle';
    const stateLabel = playtestBot.active ? `ONLINE | ${playtestBot.timeScale}x` : 'OFFLINE';
    const runLabel = latestRun ? `Run ${latestRun.runId}` : 'No runs yet';
    const lines = [runLabel];
    const snapshot = getPlaytestDebugSnapshot();
    const detailLines = [];

    if (typeof gameState !== 'undefined') {
        lines.push(`Day ${gameState.day} @ ${Math.floor(gameState.time)}s`);
        lines.push(`Stress ${Math.floor(gameState.overstimulation)}% | Tasks ${gameState.tasks.length}`);
        lines.push(`Objective: ${objectiveLabel}`);
    }

    if (playtestBot.currentRun) {
        lines.push(`Done ${gameState.stats.tasksCompleted} | Stuck ${playtestBot.currentRun.stuckCount}`);
        lines.push(`Doors ${playtestBot.currentRun.doorsToggled} | Bark ${playtestBot.currentRun.barksUsed}`);
    } else if (playtestBot.lastFinishedRun) {
        lines.push(`Last: ${playtestBot.lastFinishedRun.summary.result}`);
        lines.push(`Tasks ${playtestBot.lastFinishedRun.summary.tasksCompleted} | Peak ${playtestBot.lastFinishedRun.summary.peakStimulation}%`);
    } else {
        lines.push('Toggle the bot to start an autoplay run.');
    }

    if (snapshot) {
        detailLines.push(`Room ${snapshot.room}`);
        detailLines.push(`Pos ${snapshot.position.x},${snapshot.position.y}`);
        detailLines.push(snapshot.objective
            ? `Goal ${snapshot.objective.label} (${snapshot.objective.distance}px)`
            : 'Goal Idle');
        detailLines.push(snapshot.nextMove
            ? `Move ${snapshot.nextMove.label} -> ${snapshot.nextMove.x},${snapshot.nextMove.y}`
            : 'Move Direct');
        detailLines.push(`Route ${snapshot.route.length ? snapshot.route.join(' -> ') : 'Direct'}`);
        detailLines.push(snapshot.targetDoor
            ? `Door ${snapshot.targetDoor.name} [${snapshot.targetDoor.open ? 'open' : 'closed'}]`
            : 'Door none');
        detailLines.push(snapshot.nearbyTask
            ? `Task ${snapshot.nearbyTask.name} ${snapshot.nearbyTask.progress}/${snapshot.nearbyTask.maxProgress}`
            : 'Task none nearby');
        detailLines.push(snapshot.recovery
            ? `Recovery ${snapshot.recovery.timeLeft}s -> ${snapshot.recovery.x},${snapshot.recovery.y}`
            : `Recovery off | Stuck ${snapshot.stuckCounter}`);
    } else {
        detailLines.push('Waiting for world state.');
    }

    const eventSource = playtestBot.currentRun || playtestBot.lastFinishedRun;
    const recentEvents = eventSource ? eventSource.events.slice(-PLAYTEST_LOG_LIMIT) : [];

    playtestElements.status.textContent = stateLabel;
    playtestElements.summary.textContent = lines.join('\n');
    if (playtestElements.details) {
        playtestElements.details.textContent = detailLines.join('\n');
    }
    if (playtestElements.events) {
        playtestElements.events.textContent = recentEvents.length
            ? recentEvents.map(formatPlaytestEvent).join('\n')
            : 'No events yet.';
    }
    playtestElements.toggle.textContent = playtestBot.active ? 'STOP' : 'START';
    playtestElements.speed.textContent = `${playtestBot.timeScale}x`;
}

function recordPlaytestEvent(type, details = {}) {
    if (!playtestBot.currentRun) return;

    const event = {
        time: typeof gameState !== 'undefined' ? Number(gameState.time.toFixed(2)) : 0,
        day: typeof gameState !== 'undefined' ? gameState.day : 0,
        type
    };

    Object.assign(event, details);
    playtestBot.currentRun.events.push(event);

    if (playtestBot.currentRun.events.length > 2000) {
        playtestBot.currentRun.events.shift();
    }
}

function startPlaytestRun(source = 'manual') {
    playtestBot.currentRun = {
        runId: playtestBot.telemetry.runs.length + 1,
        startedAt: new Date().toISOString(),
        source,
        events: [],
        samples: [],
        completedTasks: [],
        spawnedTasks: [],
        stuckCount: 0,
        doorsToggled: 0,
        barksUsed: 0,
        objectiveChanges: 0,
        coffeeUsed: false
    };
    playtestBot.lastFinishedRun = null;
    playtestBot.objective = null;
    playtestBot.route = null;
    playtestBot.routeIndex = 0;
    playtestBot.stuckCounter = 0;
    playtestBot.lastPosition = null;
    playtestBot.recoveryTimer = 0;
    playtestBot.recoveryTarget = null;
    playtestBot.lastMoveTarget = null;
    playtestBot.lastRoutePreview = [];
    playtestBot.lastTargetDoorName = null;
    playtestBot.blockedObjectives = {};
    playtestBot.doorActionCooldown = 0;
    playtestBot.exitIntent = { toilet: false, relax: false };
    playtestBot.sampleTimer = 0;
    playtestBot.modalContinueDelay = 0.8;
    playtestBot.knownTaskIds = gameState.tasks.map(task => task.id);
    recordPlaytestEvent('run_started', { source });
    updatePlaytestUI();
}

function finishPlaytestRun(result, extra = {}) {
    if (!playtestBot.currentRun) return;

    const completedRun = {
        ...playtestBot.currentRun,
        endedAt: new Date().toISOString(),
        summary: {
            result,
            day: gameState.day,
            tasksCompleted: gameState.stats.tasksCompleted,
            peakStimulation: Math.floor(gameState.stats.peakStimulation),
            daysCompleted: gameState.stats.daysCompleted,
            remainingTasks: gameState.tasks.map(task => task.name),
            stuckCount: playtestBot.currentRun.stuckCount,
            doorsToggled: playtestBot.currentRun.doorsToggled,
            barksUsed: playtestBot.currentRun.barksUsed,
            ...extra
        }
    };

    playtestBot.telemetry.runs.push(completedRun);
    playtestBot.lastFinishedRun = completedRun;
    playtestBot.currentRun = null;
    playtestBot.objective = null;
    playtestBot.route = null;
    playtestBot.routeIndex = 0;
    playtestBot.recoveryTimer = 0;
    playtestBot.recoveryTarget = null;
    playtestBot.lastMoveTarget = null;
    playtestBot.lastRoutePreview = [];
    playtestBot.lastTargetDoorName = null;
    playtestBot.blockedObjectives = {};
    playtestBot.doorActionCooldown = 0;
    playtestBot.exitIntent = { toilet: false, relax: false };
    clearBotControls();
    updatePlaytestUI();
}

function togglePlaytestBot(forceActive) {
    const nextState = typeof forceActive === 'boolean' ? forceActive : !playtestBot.active;
    if (nextState === playtestBot.active) return;

    playtestBot.active = nextState;
    clearBotControls();
    playtestBot.objective = null;
    playtestBot.route = null;
    playtestBot.routeIndex = 0;
    playtestBot.recoveryTimer = 0;
    playtestBot.recoveryTarget = null;
    playtestBot.lastMoveTarget = null;
    playtestBot.lastRoutePreview = [];
    playtestBot.lastTargetDoorName = null;
    playtestBot.blockedObjectives = {};
    playtestBot.doorActionCooldown = 0;
    playtestBot.exitIntent = { toilet: false, relax: false };

    if (playtestBot.active) {
        if (!gameState.isRunning) {
            restartPlaytestRun();
            return;
        }
        if (!playtestBot.currentRun) {
            startPlaytestRun('toggle_on');
        }
        notifyPlayer('Playtest bot online.', 2.0);
    } else {
        recordPlaytestEvent('bot_paused');
        notifyPlayer('Playtest bot paused.', 2.0);
    }

    updatePlaytestUI();
}

function cyclePlaytestSpeed() {
    const currentIndex = PLAYTEST_SPEEDS.indexOf(playtestBot.timeScale);
    const nextIndex = (currentIndex + 1) % PLAYTEST_SPEEDS.length;
    playtestBot.timeScale = PLAYTEST_SPEEDS[nextIndex];
    updatePlaytestUI();

    if (typeof notifyPlayer === 'function') {
        notifyPlayer(`Playtest speed ${playtestBot.timeScale}x`, 1.5);
    }
}

function exportPlaytestData() {
    const payload = buildPlaytestExportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `overstimulated-playtest-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (typeof notifyPlayer === 'function') {
        notifyPlayer('Playtest data exported.', 2.0);
    }
}

function restartPlaytestRun() {
    hideModal();
    initGame();
}

function serializeDirectPlayerDoor(door) {
    if (!door) return null;

    const center = getDoorCenter(door);
    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    const index = typeof door.index === 'number' ? door.index : DOORS.findIndex(entry => entry.name === door.name);

    return {
        index,
        name: door.name,
        open: !!door.open,
        orient: door.orient || 'h',
        x: Math.round(center.x),
        y: Math.round(center.y),
        distance: Math.round(Math.hypot(dadCenterX - center.x, dadCenterY - center.y))
    };
}

function serializeDirectPlayerTask(task) {
    if (!task) return null;

    const target = getTaskTargetPosition(task);
    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;

    return {
        id: task.id,
        name: task.name,
        location: task.location,
        type: task.type,
        progress: Number((task.progress || 0).toFixed(2)),
        maxProgress: task.maxProgress || 0,
        duration: task.duration || 0,
        targetX: target ? Math.round(target.x) : null,
        targetY: target ? Math.round(target.y) : null,
        distance: target ? Math.round(Math.hypot(target.x - dadCenterX, target.y - dadCenterY)) : null
    };
}

function getDirectPlayerSnapshot() {
    if (typeof gameState === 'undefined') return null;

    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    const roomKey = getRoomAt(dadCenterX, dadCenterY);
    const nearbyTask = findNearbyTask();
    const nearbyDoor = findNearbyDoor();
    const relaxSpot = checkRelaxSpot(gameState.dad.x, gameState.dad.y);
    const toiletSpot = checkToiletHiding(gameState.dad.x, gameState.dad.y);
    const modal = document.getElementById('modal');

    return {
        ready: true,
        day: gameState.day,
        time: Number(gameState.time.toFixed(2)),
        timePerDay: gameState.timePerDay,
        overstimulation: Number(gameState.overstimulation.toFixed(2)),
        isRunning: !!gameState.isRunning,
        isRelaxing: !!gameState.isRelaxing,
        isHidingInToilet: !!gameState.isHidingInToilet,
        coffeeBuff: !!gameState.coffeeBuff,
        coffeeProgress: Number(gameState.coffeeProgress.toFixed(2)),
        barkCooldown: Number(gameState.barkCooldown.toFixed(2)),
        sprintEnergy: Number(gameState.sprintergyLeft.toFixed(2)),
        stats: {
            tasksCompleted: gameState.stats.tasksCompleted,
            peakStimulation: Number(gameState.stats.peakStimulation.toFixed(2)),
            daysCompleted: gameState.stats.daysCompleted
        },
        dad: {
            x: Math.round(gameState.dad.x),
            y: Math.round(gameState.dad.y),
            centerX: Math.round(dadCenterX),
            centerY: Math.round(dadCenterY),
            width: gameState.dad.width,
            height: gameState.dad.height,
            carrying: gameState.dad.carrying || null,
            roomKey,
            roomName: roomKey && ROOMS[roomKey] ? ROOMS[roomKey].name : null
        },
        tasks: gameState.tasks.map(serializeDirectPlayerTask).filter(Boolean),
        nearbyTask: serializeDirectPlayerTask(nearbyTask),
        nearbyDoor: serializeDirectPlayerDoor(nearbyDoor),
        relaxSpot: relaxSpot ? { key: relaxSpot.key, type: relaxSpot.obj.type } : null,
        toiletSpot: toiletSpot ? { canHide: !!toiletSpot.canHide, doorClosed: !!toiletSpot.doorClosed } : null,
        nearCoffee: checkCoffeeMachine(gameState.dad.x, gameState.dad.y),
        notification: gameState.notification ? {
            message: gameState.notification.message,
            timeLeft: Number(gameState.notification.timeLeft.toFixed(2))
        } : null,
        pois: {
            livingRoom: { x: Math.round(WAYPOINTS.LIVING_ROOM.pixelX), y: Math.round(WAYPOINTS.LIVING_ROOM.pixelY) },
            couch: getWorldObjectCenter('COUCH'),
            bed: getWorldObjectCenter('BED'),
            toilet: getWorldObjectCenter('TOILET'),
            coffee: getCoffeeInteractionPoint(),
            sprinkler: { x: Math.round(POIS.SPRINKLER.x * TILE_SIZE), y: Math.round(POIS.SPRINKLER.y * TILE_SIZE) }
        },
        modal: {
            visible: modal ? getComputedStyle(modal).display !== 'none' : false,
            title: document.getElementById('modal-title') ? document.getElementById('modal-title').textContent : '',
            text: document.getElementById('modal-text') ? document.getElementById('modal-text').innerText : ''
        }
    };
}

function getDirectPlayerRoutePlan(targetX, targetY) {
    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    const directDistance = Math.hypot(targetX - dadCenterX, targetY - dadCenterY);
    const canGoDirect = directDistance < 30 || hasLineOfSight(dadCenterX, dadCenterY, targetX, targetY, gameState.dad.width);

    if (canGoDirect) {
        gameState.directPlayerIntentDoorName = null;
        return {
            directDistance: Math.round(directDistance),
            canGoDirect: true,
            route: [],
            nextTarget: { x: Math.round(targetX), y: Math.round(targetY), waypointName: null, label: 'Direct' },
            targetDoor: null
        };
    }

    const route = findBestWaypointRoute(dadCenterX, dadCenterY, targetX, targetY, {
        bodySize: gameState.dad.width,
        routeContext: { canUseDoors: true }
    });
    if (!route || !route.waypoints || route.waypoints.length === 0) {
        gameState.directPlayerIntentDoorName = null;
        return {
            directDistance: Math.round(directDistance),
            canGoDirect: false,
            route: [],
            nextTarget: { x: Math.round(targetX), y: Math.round(targetY), waypointName: null, label: 'Direct' },
            targetDoor: null
        };
    }

    let nextTarget = { x: Math.round(targetX), y: Math.round(targetY), waypointName: null, label: 'Direct' };
    const visibleRouteTarget = getVisibleRouteWaypoint(
        route.waypoints,
        0,
        dadCenterX,
        dadCenterY,
        gameState.dad.width
    );
    if (visibleRouteTarget.target) {
        const waypointName = visibleRouteTarget.target.waypointName;
        const waypoint = WAYPOINTS[waypointName];
        if (waypoint) {
        nextTarget = {
            x: Math.round(waypoint.pixelX),
            y: Math.round(waypoint.pixelY),
            waypointName,
            label: describePlaytestWaypoint(waypointName)
        };
        }
    }

    const targetDoor = serializeDirectPlayerDoor(getDoorForWaypointName(nextTarget.waypointName));
    gameState.directPlayerIntentDoorName = targetDoor ? targetDoor.name : null;
    return {
        directDistance: Math.round(directDistance),
        canGoDirect: false,
        route: route.waypoints.map(describePlaytestWaypoint),
        nextTarget,
        targetDoor
    };
}

function getDirectPlayerRecoveryPoint(targetX, targetY) {
    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    const angle = Math.atan2(targetY - dadCenterY, targetX - dadCenterX);
    const candidates = [
        { x: dadCenterX + Math.cos(angle + Math.PI / 2) * 72, y: dadCenterY + Math.sin(angle + Math.PI / 2) * 72 },
        { x: dadCenterX + Math.cos(angle - Math.PI / 2) * 72, y: dadCenterY + Math.sin(angle - Math.PI / 2) * 72 },
        { x: dadCenterX - Math.cos(angle) * 56, y: dadCenterY - Math.sin(angle) * 56 }
    ];

    for (const candidate of candidates) {
        const topLeftX = candidate.x - gameState.dad.width / 2;
        const topLeftY = candidate.y - gameState.dad.height / 2;
        if (!canMoveTo(topLeftX, topLeftY, gameState.dad.width, gameState.dad.height)) continue;
        if (!canPassDoor(topLeftX, topLeftY, gameState.dad.width, gameState.dad.height)) continue;
        if (!hasLineOfSight(dadCenterX, dadCenterY, candidate.x, candidate.y, gameState.dad.width)) continue;

        return { x: Math.round(candidate.x), y: Math.round(candidate.y) };
    }

    return null;
}

function setDirectPlayerControls(state = {}) {
    input.up = !!state.up;
    input.down = !!state.down;
    input.left = !!state.left;
    input.right = !!state.right;
    input.sprinting = !!state.sprinting;
    if (state.actionHeld) {
        if (!input.actionHeld) {
            input.actionStartTime = Date.now();
        }
        input.actionHeld = true;
    } else {
        input.actionHeld = false;
    }
}

function tapDirectPlayerControl(kind = 'action') {
    if (kind === 'bark') {
        input.bark = true;
    } else if (kind === 'interact') {
        input.interact = true;
    } else {
        input.actionHeld = false;
        input.action = true;
    }
}

function restartDirectPlayerRun() {
    playtestBot.active = false;
    hideModal();
    clearBotControls();
    initGame();
    playtestBot.active = false;
    updatePlaytestUI();
}

window.directPlayerApi = {
    getSnapshot: getDirectPlayerSnapshot,
    planRoute: getDirectPlayerRoutePlan,
    getRecoveryPoint: getDirectPlayerRecoveryPoint,
    setControls: setDirectPlayerControls,
    tapControl: tapDirectPlayerControl,
    clearControls: clearBotControls,
    restartRun: restartDirectPlayerRun,
    exportTelemetry: buildPlaytestExportPayload
};

function scoreTaskForPlaytest(task) {
    const target = getTaskTargetPosition(task);
    if (!target) return -Infinity;

    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    const distancePenalty = Math.hypot(target.x - dadCenterX, target.y - dadCenterY) / 30;

    let score = task.type === 'fetch' ? 120 : task.type === 'coverage' ? 95 : 80;

    if (task.name === 'MOVE SPRINKLER') score += 90;
    if (task.name === 'ROUND UP CHICKENS') score += 80;
    if (task.name === 'GET BEER') score += 65;
    if (task.name.startsWith('Clean poop')) score += 45 + task.maxProgress * 2;
    if (task.name.startsWith('Collect toys')) score += 35 + task.maxProgress;
    if (task.location === 'Baby') score -= 15;
    if (gameState.overstimulation > 75 && task.type === 'hold') score -= 20;

    return score - distancePenalty;
}

function choosePlaytestTask() {
    let bestTask = null;
    let bestScore = -Infinity;

    for (const task of gameState.tasks) {
        const score = scoreTaskForPlaytest(task);
        if (score > bestScore) {
            bestScore = score;
            bestTask = task;
        }
    }

    return bestTask;
}

function getPlaytestObjectiveKey(objective) {
    if (!objective) return null;
    if (objective.type === 'task') return `task:${objective.taskId}`;
    return `${objective.type}:${objective.label}`;
}

function isPlaytestObjectiveBlocked(objective) {
    const key = getPlaytestObjectiveKey(objective);
    if (!key) return false;
    const blockedUntil = playtestBot.blockedObjectives[key];
    if (!blockedUntil) return false;
    if (blockedUntil <= gameState.time) {
        delete playtestBot.blockedObjectives[key];
        return false;
    }
    return true;
}

function markPlaytestObjectiveBlocked(objective, duration = 25) {
    const key = getPlaytestObjectiveKey(objective);
    if (!key) return;
    playtestBot.blockedObjectives[key] = gameState.time + duration;
    recordPlaytestEvent('objective_blocked', {
        label: objective.label,
        objectiveType: objective.type,
        blockedUntil: Number((gameState.time + duration).toFixed(2))
    });
}

function buildPlaytestRoute(targetX, targetY) {
    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    const route = findBestWaypointRoute(dadCenterX, dadCenterY, targetX, targetY, {
        bodySize: gameState.dad.width,
        routeContext: { canUseDoors: true }
    });
    if (!route || !route.waypoints || route.waypoints.length === 0) return null;

    return {
        targetX,
        targetY,
        builtAt: gameState.time,
        waypoints: route.waypoints
    };
}

function getVisibleRouteWaypoint(routeWaypoints, startIndex, originX, originY, bodySize = DAD_HITBOX_SIZE) {
    let nextIndex = startIndex;
    let fallbackTarget = null;
    let chosenTarget = null;
    const originRoomKey = getRoomAt(originX, originY);
    const shouldAnchorInCurrentRoom = originRoomKey === 'CORRIDOR_LEFT'
        || originRoomKey === 'CORRIDOR_RIGHT'
        || originRoomKey === 'PATIO_STRIP';

    for (let index = startIndex; index < routeWaypoints.length; index++) {
        const waypointName = routeWaypoints[index];
        const waypoint = WAYPOINTS[waypointName];
        if (!waypoint) {
            nextIndex = index + 1;
            continue;
        }

        if (waypointName === originRoomKey && index < routeWaypoints.length - 1 && !shouldAnchorInCurrentRoom) {
            nextIndex = index + 1;
            continue;
        }

        if (hasReachedWaypoint(waypointName, originX, originY, bodySize)) {
            nextIndex = index + 1;
            continue;
        }

        const target = { x: waypoint.pixelX, y: waypoint.pixelY, waypointName, routeIndex: index };
        if (!fallbackTarget) {
            fallbackTarget = target;
        }

        if (hasLineOfSight(originX, originY, waypoint.pixelX, waypoint.pixelY, bodySize)) {
            chosenTarget = target;
            nextIndex = index;
            if (isDoorWaypointName(waypointName)) {
                break;
            }
            continue;
        }

        break;
    }

    return {
        routeIndex: nextIndex,
        target: chosenTarget || fallbackTarget
    };
}

function getPlaytestMoveTarget(targetX, targetY) {
    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    const directDistance = Math.hypot(targetX - dadCenterX, targetY - dadCenterY);

    if (directDistance < 30 || hasLineOfSight(dadCenterX, dadCenterY, targetX, targetY, gameState.dad.width)) {
        playtestBot.route = null;
        playtestBot.routeIndex = 0;
        return { x: targetX, y: targetY, waypointName: null };
    }

    const needsNewRoute = !playtestBot.route ||
        Math.hypot(playtestBot.route.targetX - targetX, playtestBot.route.targetY - targetY) > 5 ||
        gameState.time - playtestBot.route.builtAt > 2.5;

    if (needsNewRoute) {
        playtestBot.route = buildPlaytestRoute(targetX, targetY);
        playtestBot.routeIndex = 0;
    }

    if (!playtestBot.route) {
        return { x: targetX, y: targetY, waypointName: null };
    }

    const visibleRouteTarget = getVisibleRouteWaypoint(
        playtestBot.route.waypoints,
        playtestBot.routeIndex,
        dadCenterX,
        dadCenterY,
        gameState.dad.width
    );

    playtestBot.routeIndex = visibleRouteTarget.routeIndex;
    if (visibleRouteTarget.target) {
        return {
            x: visibleRouteTarget.target.x,
            y: visibleRouteTarget.target.y,
            waypointName: visibleRouteTarget.target.waypointName
        };
    }

    return { x: targetX, y: targetY, waypointName: null };
}

function setPlaytestMovementToward(targetX, targetY, targetDoor = null) {
    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    const dx = targetX - dadCenterX;
    const dy = targetY - dadCenterY;
    const distance = Math.hypot(dx, dy);
    const deadZone = 6;
    const alignThreshold = 12;

    let moveX = dx;
    let moveY = dy;
    if (targetDoor) {
        if (targetDoor.orient === 'v' && Math.abs(dy) > alignThreshold && Math.abs(dx) > 18) {
            moveX = 0;
        } else if (targetDoor.orient === 'h' && Math.abs(dx) > alignThreshold && Math.abs(dy) > 18) {
            moveY = 0;
        }
    }

    input.left = moveX < -deadZone;
    input.right = moveX > deadZone;
    input.up = moveY < -deadZone;
    input.down = moveY > deadZone;
    input.sprinting = !targetDoor && distance > 220 && gameState.sprintergyLeft > 25;
}

function cachePlaytestMoveTarget(moveTarget) {
    playtestBot.lastMoveTarget = moveTarget;
    playtestBot.lastRoutePreview = playtestBot.route
        ? playtestBot.route.waypoints.slice(playtestBot.routeIndex, playtestBot.routeIndex + 5)
        : [];
    const targetDoor = getDoorForWaypointName(moveTarget ? moveTarget.waypointName : null);
    playtestBot.lastTargetDoorName = targetDoor ? targetDoor.name : null;
    return targetDoor;
}

function movePlaytestToward(targetX, targetY) {
    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    const moveTarget = getPlaytestMoveTarget(targetX, targetY);
    const targetDoor = cachePlaytestMoveTarget(moveTarget);

    setPlaytestMovementToward(moveTarget.x, moveTarget.y, targetDoor);

    if (targetDoor && !targetDoor.open) {
        const doorCenter = getDoorCenter(targetDoor);
        if (Math.hypot(dadCenterX - doorCenter.x, dadCenterY - doorCenter.y) < 72) {
            if (playtestBot.doorActionCooldown <= 0) {
                input.action = true;
                playtestBot.doorActionCooldown = 0.35;
            }
        }
    }

    return { moveTarget, targetDoor };
}

function queuePlaytestRecovery(targetX, targetY) {
    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    const angle = Math.atan2(targetY - dadCenterY, targetX - dadCenterX);
    const candidates = [
        { x: dadCenterX + Math.cos(angle + Math.PI / 2) * 72, y: dadCenterY + Math.sin(angle + Math.PI / 2) * 72 },
        { x: dadCenterX + Math.cos(angle - Math.PI / 2) * 72, y: dadCenterY + Math.sin(angle - Math.PI / 2) * 72 },
        { x: dadCenterX - Math.cos(angle) * 56, y: dadCenterY - Math.sin(angle) * 56 }
    ];

    for (const candidate of candidates) {
        const topLeftX = candidate.x - gameState.dad.width / 2;
        const topLeftY = candidate.y - gameState.dad.height / 2;
        if (!canMoveTo(topLeftX, topLeftY, gameState.dad.width, gameState.dad.height)) {
            continue;
        }
        if (!canPassDoor(topLeftX, topLeftY, gameState.dad.width, gameState.dad.height)) {
            continue;
        }
        if (!hasLineOfSight(dadCenterX, dadCenterY, candidate.x, candidate.y, gameState.dad.width)) {
            continue;
        }

        playtestBot.recoveryTimer = 0.45;
        playtestBot.recoveryTarget = candidate;
        recordPlaytestEvent('recovery', { x: Math.round(candidate.x), y: Math.round(candidate.y) });
        return true;
    }

    return false;
}

function getPlaytestObjective() {
    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    const dadRoomKey = getRoomAt(dadCenterX, dadCenterY);
    const task = choosePlaytestTask();
    if (task) {
        const target = getTaskTargetPosition(task);
        if (target) {
            const taskObjective = {
                type: 'task',
                label: `Task: ${task.name}`,
                taskId: task.id,
                taskType: task.type,
                targetX: target.x,
                targetY: target.y
            };
            if (!isPlaytestObjectiveBlocked(taskObjective)) {
                return taskObjective;
            }
        }
    }

    if (gameState.overstimulation >= 82) {
        const toilet = getWorldObjectCenter('TOILET');
        if (toilet) {
            const toiletObjective = { type: 'toilet', label: 'Hide in toilet', targetX: toilet.x, targetY: toilet.y };
            if (!isPlaytestObjectiveBlocked(toiletObjective)) {
                return toiletObjective;
            }
        }
    }

    if (gameState.overstimulation >= 62) {
        const couch = getWorldObjectCenter('COUCH') || getWorldObjectCenter('BED');
        if (couch) {
            const relaxObjective = { type: 'relax', label: 'Take a breather', targetX: couch.x, targetY: couch.y };
            if (!isPlaytestObjectiveBlocked(relaxObjective)) {
                return relaxObjective;
            }
        }
    }

    if (playtestBot.currentRun && !playtestBot.currentRun.coffeeUsed && !gameState.coffeeBuff && gameState.time < 110 && gameState.overstimulation < 68 && gameState.tasks.length <= 2) {
        const coffee = getCoffeeInteractionPoint();
        if (coffee && dadRoomKey === 'KITCHEN') {
            const coffeeObjective = { type: 'coffee', label: 'Brew coffee', targetX: coffee.x, targetY: coffee.y };
            if (!isPlaytestObjectiveBlocked(coffeeObjective)) {
                return coffeeObjective;
            }
        }
    }

    return {
        type: 'idle',
        label: 'Stand by in living room',
        targetX: WAYPOINTS.LIVING_ROOM.pixelX,
        targetY: WAYPOINTS.LIVING_ROOM.pixelY
    };
}

function isPlaytestObjectiveValid(objective) {
    if (!objective) return false;

    if (objective.type === 'task') {
        return gameState.tasks.some(task => task.id === objective.taskId);
    }

    if (objective.type === 'coffee') {
        return playtestBot.currentRun && !playtestBot.currentRun.coffeeUsed && !gameState.coffeeBuff;
    }

    return true;
}

function setPlaytestObjective(objective) {
    const current = playtestBot.objective;
    const sameObjective = current && objective &&
        current.type === objective.type &&
        current.taskId === objective.taskId &&
        current.label === objective.label;

    if (sameObjective) return;

    playtestBot.objective = objective;
    playtestBot.objectiveStartedAt = gameState.time;
    playtestBot.route = null;
    playtestBot.routeIndex = 0;
    playtestBot.recoveryTimer = 0;
    playtestBot.recoveryTarget = null;
    playtestBot.lastMoveTarget = null;
    playtestBot.lastRoutePreview = [];
    playtestBot.lastTargetDoorName = null;

    if (objective && playtestBot.currentRun) {
        playtestBot.currentRun.objectiveChanges++;
        recordPlaytestEvent('objective', {
            label: objective.label,
            objectiveType: objective.type,
            targetX: Math.round(objective.targetX),
            targetY: Math.round(objective.targetY)
        });
    }
}

function samplePlaytestRun(dt) {
    if (!playtestBot.currentRun) return;

    for (const task of gameState.tasks) {
        if (!playtestBot.knownTaskIds.includes(task.id)) {
            playtestBot.knownTaskIds.push(task.id);
            playtestBot.currentRun.spawnedTasks.push({
                time: Number(gameState.time.toFixed(2)),
                day: gameState.day,
                id: task.id,
                name: task.name,
                location: task.location,
                type: task.type
            });
            recordPlaytestEvent('task_spawned', { name: task.name, location: task.location, taskType: task.type });
        }
    }

    playtestBot.sampleTimer -= dt;
    if (playtestBot.sampleTimer > 0) return;
    playtestBot.sampleTimer = 5;

    playtestBot.currentRun.samples.push({
        time: Number(gameState.time.toFixed(2)),
        day: gameState.day,
        stress: Number(gameState.overstimulation.toFixed(1)),
        tasksRemaining: gameState.tasks.length,
        objective: playtestBot.objective ? playtestBot.objective.label : 'Idle',
        room: getRoomAt(gameState.dad.x + gameState.dad.width / 2, gameState.dad.y + gameState.dad.height / 2),
        nextMove: playtestBot.lastMoveTarget ? describePlaytestWaypoint(playtestBot.lastMoveTarget.waypointName) : 'Direct',
        recovery: playtestBot.recoveryTimer > 0,
        x: Math.round(gameState.dad.x),
        y: Math.round(gameState.dad.y)
    });
}

function updatePlaytestBot(dt) {
    playtestBot.doorActionCooldown = Math.max(0, playtestBot.doorActionCooldown - dt);
    playtestBot.uiTimer -= dt;
    if (playtestBot.uiTimer <= 0) {
        playtestBot.uiTimer = 0.25;
        updatePlaytestUI();
    }

    if (!playtestBot.active) return;
    if (!gameState.isRunning) {
        clearBotControls();
        return;
    }

    if (!playtestBot.currentRun) {
        startPlaytestRun('resume');
    }

    input.action = false;
    input.bark = false;
    input.interact = false;
    input.actionHeld = false;

    if (isModalVisible()) {
        clearBotControls();
        playtestBot.modalContinueDelay -= dt;
        if (gameState.isRunning && playtestBot.modalContinueDelay <= 0) {
            const modalButton = document.getElementById('modal-button');
            if (modalButton) {
                modalButton.click();
            }
            playtestBot.modalContinueDelay = 0.8;
        }
        return;
    }

    playtestBot.modalContinueDelay = 0.8;
    samplePlaytestRun(dt);

    if (playtestBot.currentRun && gameState.coffeeBuff) {
        playtestBot.currentRun.coffeeUsed = true;
    }

    if (gameState.isHidingInToilet) {
        clearBotControls();
        cachePlaytestMoveTarget({ x: playtestBot.objective ? playtestBot.objective.targetX : gameState.dad.x, y: playtestBot.objective ? playtestBot.objective.targetY : gameState.dad.y, waypointName: null });
        if (gameState.overstimulation <= 38 || gameState.time - playtestBot.objectiveStartedAt > 8) {
            input.action = true;
            if (!playtestBot.exitIntent.toilet) {
                recordPlaytestEvent('toilet_exit');
                playtestBot.exitIntent.toilet = true;
            }
        }
        return;
    }
    playtestBot.exitIntent.toilet = false;

    if (gameState.isRelaxing) {
        clearBotControls();
        cachePlaytestMoveTarget({ x: playtestBot.objective ? playtestBot.objective.targetX : gameState.dad.x, y: playtestBot.objective ? playtestBot.objective.targetY : gameState.dad.y, waypointName: null });
        if (gameState.overstimulation <= 32 || (gameState.tasks.length > 0 && gameState.time - playtestBot.objectiveStartedAt > 5)) {
            input.action = true;
            if (!playtestBot.exitIntent.relax) {
                recordPlaytestEvent('relax_exit');
                playtestBot.exitIntent.relax = true;
            }
        }
        return;
    }
    playtestBot.exitIntent.relax = false;

    if (playtestBot.recoveryTimer > 0 && playtestBot.recoveryTarget) {
        playtestBot.recoveryTimer = Math.max(0, playtestBot.recoveryTimer - dt);
        cachePlaytestMoveTarget({ x: playtestBot.recoveryTarget.x, y: playtestBot.recoveryTarget.y, waypointName: null });
        const recoveryDistance = Math.hypot(
            playtestBot.recoveryTarget.x - (gameState.dad.x + gameState.dad.width / 2),
            playtestBot.recoveryTarget.y - (gameState.dad.y + gameState.dad.height / 2)
        );
        if (recoveryDistance > 12) {
            setPlaytestMovementToward(playtestBot.recoveryTarget.x, playtestBot.recoveryTarget.y);
        } else {
            clearBotControls();
        }
        if (playtestBot.recoveryTimer > 0 && recoveryDistance > 12) {
            return;
        }
        playtestBot.recoveryTimer = 0;
        playtestBot.recoveryTarget = null;
    }

    const candidateObjective = getPlaytestObjective();
    const needsRefresh = !isPlaytestObjectiveValid(playtestBot.objective) ||
        !playtestBot.objective ||
        (candidateObjective.type === 'toilet' && playtestBot.objective.type !== 'toilet') ||
        (candidateObjective.type === 'task' && playtestBot.objective.type !== 'task') ||
        (candidateObjective.type === 'task' && playtestBot.objective.type === 'task' && candidateObjective.taskId !== playtestBot.objective.taskId && gameState.time - playtestBot.objectiveStartedAt > 3) ||
        (candidateObjective.type !== 'idle' && playtestBot.objective.type === 'idle');

    if (needsRefresh) {
        setPlaytestObjective(candidateObjective);
    }

    if (!playtestBot.objective) return;

    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    const distanceToGoal = Math.hypot(playtestBot.objective.targetX - dadCenterX, playtestBot.objective.targetY - dadCenterY);
    const nearbyDoor = findNearbyDoor();
    let activeDoor = null;

    if (playtestBot.objective.type === 'task') {
        const task = gameState.tasks.find(entry => entry.id === playtestBot.objective.taskId);
        if (!task) {
            setPlaytestObjective(null);
            return;
        }

        const nearbyTask = findNearbyTask();
        if (nearbyTask && nearbyTask.id === task.id) {
            clearBotControls();
            cachePlaytestMoveTarget({ x: playtestBot.objective.targetX, y: playtestBot.objective.targetY, waypointName: null });
            if (task.type === 'fetch') {
                input.action = true;
            } else {
                input.actionHeld = true;
            }
        } else {
            activeDoor = movePlaytestToward(playtestBot.objective.targetX, playtestBot.objective.targetY).targetDoor;
        }
    } else if (playtestBot.objective.type === 'coffee') {
        if (checkCoffeeMachine(gameState.dad.x, gameState.dad.y)) {
            clearBotControls();
            cachePlaytestMoveTarget({ x: playtestBot.objective.targetX, y: playtestBot.objective.targetY, waypointName: null });
            input.actionHeld = true;
        } else {
            activeDoor = movePlaytestToward(playtestBot.objective.targetX, playtestBot.objective.targetY).targetDoor;
        }
    } else if (playtestBot.objective.type === 'toilet') {
        if (distanceToGoal < 55) {
            clearBotControls();
            cachePlaytestMoveTarget({ x: playtestBot.objective.targetX, y: playtestBot.objective.targetY, waypointName: null });
            input.action = true;
            recordPlaytestEvent('toilet_enter');
        } else {
            activeDoor = movePlaytestToward(playtestBot.objective.targetX, playtestBot.objective.targetY).targetDoor;
        }
    } else if (playtestBot.objective.type === 'relax') {
        const relaxSpot = checkRelaxSpot(gameState.dad.x, gameState.dad.y);
        if (relaxSpot) {
            clearBotControls();
            cachePlaytestMoveTarget({ x: playtestBot.objective.targetX, y: playtestBot.objective.targetY, waypointName: null });
            input.action = true;
        } else {
            activeDoor = movePlaytestToward(playtestBot.objective.targetX, playtestBot.objective.targetY).targetDoor;
        }
    } else if (distanceToGoal > 60) {
        activeDoor = movePlaytestToward(playtestBot.objective.targetX, playtestBot.objective.targetY).targetDoor;
    } else {
        clearBotControls();
        cachePlaytestMoveTarget({ x: playtestBot.objective.targetX, y: playtestBot.objective.targetY, waypointName: null });
    }

    const adultsNearby = [gameState.npcStates.wife, gameState.npcStates.housemate].some(npc => npc && Math.hypot(npc.x - dadCenterX, npc.y - dadCenterY) < 140);
    if (adultsNearby && gameState.tasks.length >= 3 && gameState.barkCooldown <= 0 && (!playtestBot.currentRun.lastBarkAt || gameState.time - playtestBot.currentRun.lastBarkAt > 10)) {
        input.bark = true;
        playtestBot.currentRun.lastBarkAt = gameState.time;
        playtestBot.currentRun.barksUsed++;
        recordPlaytestEvent('bark');
    }

    if (!playtestBot.lastPosition) {
        playtestBot.lastPosition = { x: dadCenterX, y: dadCenterY, checkIn: 1.2 };
        return;
    }

    playtestBot.lastPosition.checkIn -= dt;
    if (playtestBot.lastPosition.checkIn <= 0) {
        const movedDistance = Math.hypot(dadCenterX - playtestBot.lastPosition.x, dadCenterY - playtestBot.lastPosition.y);
        if (movedDistance < 8 && playtestBot.objective && distanceToGoal > 50) {
            playtestBot.stuckCounter++;
            playtestBot.currentRun.stuckCount++;
            const roomKey = getRoomAt(dadCenterX, dadCenterY);
            recordPlaytestEvent('stuck', {
                objective: playtestBot.objective.label,
                count: playtestBot.stuckCounter,
                x: Math.round(dadCenterX),
                y: Math.round(dadCenterY),
                room: roomKey ? ROOMS[roomKey].name : 'Unknown'
            });
            const relevantDoor = activeDoor || (playtestBot.lastMoveTarget ? getDoorForWaypointName(playtestBot.lastMoveTarget.waypointName) : null) || nearbyDoor;
            if (relevantDoor && !relevantDoor.open && playtestBot.doorActionCooldown <= 0) {
                input.action = true;
                playtestBot.doorActionCooldown = 0.35;
            }
            if (playtestBot.stuckCounter >= 2) {
                playtestBot.route = null;
                queuePlaytestRecovery(playtestBot.objective.targetX, playtestBot.objective.targetY);
            }
            if (playtestBot.stuckCounter >= 5) {
                markPlaytestObjectiveBlocked(playtestBot.objective);
                setPlaytestObjective(null);
                playtestBot.stuckCounter = 0;
            }
        } else {
            playtestBot.stuckCounter = 0;
        }

        playtestBot.lastPosition = { x: dadCenterX, y: dadCenterY, checkIn: 1.2 };
    }
}

function getPOIByName(name) {
    for (const poi of Object.values(POIS)) {
        if (poi.name === name) return poi;
    }
    return null;
}

function addTaskIfMissing(name, location, type, duration = 0, maxProgress = 1) {
    const existingTask = gameState.tasks.find(t => t.name === name);
    if (existingTask) return existingTask;

    const task = new Task(gameState.nextTaskId++, type, name, location, duration, 0, maxProgress);
    gameState.tasks.push(task);
    return task;
}

function getTaskTargetPosition(task) {
    const poi = getPOIByName(task.location);
    if (!poi) return null;
    return {
        x: poi.x * TILE_SIZE,
        y: poi.y * TILE_SIZE
    };
}

function findNearestTaskToPoint(x, y) {
    let nearestTask = null;
    let nearestDistance = Infinity;

    for (const task of gameState.tasks) {
        const target = getTaskTargetPosition(task);
        if (!target) continue;

        const distance = Math.hypot(target.x - x, target.y - y);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestTask = task;
        }
    }

    return nearestTask;
}

function clearAdultHelpState(npc) {
    npc.helpingTimer = 0;
    npc.helpTargetTaskId = null;
    npc.targetX = null;
    npc.targetY = null;
}

function applyTaskAssistance(taskId, helperName) {
    const task = gameState.tasks.find(t => t.id === taskId);
    if (!task) return false;

    if (task.type === 'fetch') {
        completeTask(task.id);
        notifyPlayer(`${helperName} handled ${task.name}.`, 2.5);
        return true;
    }

    const boost = Math.max(1, task.maxProgress * 0.25);
    task.progress = Math.min(task.maxProgress, task.progress + boost);
    notifyPlayer(`${helperName} helped with ${task.name}.`, 2.5);

    if (task.progress >= task.maxProgress) {
        completeTask(task.id);
    }

    return true;
}

function assignAdultHelp(npc, npcKey, barkX, barkY) {
    const nearestTask = findNearestTaskToPoint(barkX, barkY);
    if (!nearestTask) {
        npc.helpingTimer = 5.0;
        npc.helpTargetTaskId = null;
        npc.targetX = barkX;
        npc.targetY = barkY;
        return;
    }

    const target = getTaskTargetPosition(nearestTask);
    if (!target) return;

    npc.helpingTimer = 6.0;
    npc.helpTargetTaskId = nearestTask.id;
    npc.targetX = target.x;
    npc.targetY = target.y;

    const helperCharacter = npcKey === 'wife' ? 'wife' : 'jake';
    const line = npcKey === 'wife' ? 'On it!' : 'Yeah, alright.';
    addDialogue(helperCharacter, line, 2.5);
}

function checkMower(x, y) {
    if (!gameState.mower || gameState.dad.carrying === 'MOWER') return null;

    const mowerCenterX = gameState.mower.x + gameState.mower.width / 2;
    const mowerCenterY = gameState.mower.y + gameState.mower.height / 2;
    const dadCenterX = x + gameState.dad.width / 2;
    const dadCenterY = y + gameState.dad.height / 2;
    const dist = Math.hypot(mowerCenterX - dadCenterX, mowerCenterY - dadCenterY);

    return dist < 70 ? gameState.mower : null;
}

function mowGrassAt(x, y) {
    const outdoors = isInRoom({ x, y }, 'DOG_YARD') || isInRoom({ x, y }, 'CHICKEN_YARD');
    if (!outdoors) return;

    const patchSize = 28;
    const patchX = Math.floor(x / patchSize) * patchSize;
    const patchY = Math.floor(y / patchSize) * patchSize;
    gameState.mowedGrass.add(`${patchX},${patchY}`);
}


// Update game state
function update(deltaTime) {
    if (!gameState.isRunning) return;

    // Apply debug speed multiplier
    const effectiveDeltaTime = deltaTime * (DEBUG_MODE ? DEBUG_SPEED_MULTIPLIER : 1);

    gameState.time += effectiveDeltaTime;
    if (gameState.notification) {
        gameState.notification.timeLeft -= effectiveDeltaTime;
        if (gameState.notification.timeLeft <= 0) {
            gameState.notification = null;
        }
    }

    // Check if day is over
    if (gameState.time >= gameState.timePerDay) {
        endDay();
        return;
    }

    updatePlaytestBot(effectiveDeltaTime);

    // Dad movement (faster base speed)
    // If relaxing, don't allow movement
    if (!gameState.isRelaxing && !gameState.isHidingInToilet) {
        let newX = gameState.dad.x;
        let newY = gameState.dad.y;

        const baseSpeed = 112;
        const sprintMultiplier = input.sprinting ? 1.5 : 1.0;

        // Apply slowdown for obstacles (toys, poop, characters)
        let slowdownMultiplier = 1.0;
        const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
        const dadCenterY = gameState.dad.y + gameState.dad.height / 2;

        // Check for poop and toys nearby (within 40px)
        for (let ent of gameState.entities) {
            const dist = Math.hypot(dadCenterX - ent.x, dadCenterY - ent.y);
            if (dist < 40) {
                slowdownMultiplier *= 0.7; // 30% slowdown per obstacle
            }
        }

        // Check for NPC collisions (characters also slow you down)
        for (let npc of Object.values(gameState.npcStates)) {
            if (npc && npc.x && npc.y) {
                const dist = Math.hypot(dadCenterX - npc.x, dadCenterY - npc.y);
                if (dist < 50) {
                    slowdownMultiplier *= 0.8; // 20% slowdown per NPC
                }
            }
        }

        slowdownMultiplier = Math.max(0.3, slowdownMultiplier); // Cap at 30% speed minimum
        const mowerMultiplier = gameState.dad.carrying === 'MOWER' ? 0.5 : 1.0;
        const moveSpeed = baseSpeed * sprintMultiplier * slowdownMultiplier * mowerMultiplier * effectiveDeltaTime;

        if (input.up) newY -= moveSpeed;
        if (input.down) newY += moveSpeed;
        if (input.left) newX -= moveSpeed;
        if (input.right) newX += moveSpeed;

        // Apply collision detection
        if (canMoveTo(newX, gameState.dad.y, gameState.dad.width, gameState.dad.height)) {
            gameState.dad.x = newX;
        }
        if (canMoveTo(gameState.dad.x, newY, gameState.dad.width, gameState.dad.height)) {
            gameState.dad.y = newY;
        }

        if (gameState.dad.carrying === 'MOWER' && (input.up || input.down || input.left || input.right)) {
            mowGrassAt(
                gameState.dad.x + gameState.dad.width / 2,
                gameState.dad.y + gameState.dad.height / 2
            );
        }

        // Push Dad out of any solids (walls or closed doors)
        pushOutOfSolids(gameState.dad, gameState.dad.width, gameState.dad.height);
    } else if (gameState.isRelaxing) {
        // When relaxing, snap to furniture center and prevent movement
        const obj = WORLD_OBJECTS[gameState.relaxSpot];
        if (obj) {
            const furnitureX = (obj.x + OFFSET_X + obj.w / 2) * TILE_SIZE - gameState.dad.width / 2;
            const furnitureY = (obj.y + OFFSET_Y + obj.h / 2) * TILE_SIZE - gameState.dad.height / 2;
            gameState.dad.x = furnitureX;
            gameState.dad.y = furnitureY;
        }
    }

    // Action handling
    if (input.actionHeld) {

        // Coffee brewing
        const nearCoffee = checkCoffeeMachine(gameState.dad.x, gameState.dad.y);
        if (nearCoffee && !gameState.coffeeBuff) {
            gameState.coffeeProgress += effectiveDeltaTime;
            if (gameState.coffeeProgress >= gameState.coffeeBrewTime) {
                gameState.coffeeBuff = true;
                gameState.coffeeBuffTimer = gameState.coffeeBuffDuration;
                gameState.coffeeProgress = 0;
                notifyPlayer("COFFEE READY! +60s STRESS RESISTANCE");

                // Dad celebrates coffee
                const line = dialogueLines.dad.coffee[Math.floor(Math.random() * dialogueLines.dad.coffee.length)];
                addDialogue('dad', line, 5);
            }
        }

        const nearbyTask = findNearbyTask();

        if (nearbyTask) {
            if (nearbyTask.type === 'hold') {
                nearbyTask.active = true;
                nearbyTask.progress = Math.min(nearbyTask.maxProgress, nearbyTask.progress + effectiveDeltaTime);
                // Holding a task does not directly add stress here; stress is handled via the baseline model below
            } else if (nearbyTask.type === 'coverage') {
                // Can also work on coverage by holding
                const prevProg = Math.floor(nearbyTask.progress);
                nearbyTask.progress = Math.min(nearbyTask.maxProgress, nearbyTask.progress + effectiveDeltaTime * 2);
                // Remove a poop entity each time we cross an integer of progress
                if (nearbyTask.name && nearbyTask.name.startsWith('Clean poop') && Math.floor(nearbyTask.progress) > prevProg) {
                    try {
                        const poop = findNearestEntity(gameState.dad.x, gameState.dad.y, 'poop', 200);
                        if (poop) removeEntity(poop);
                    } catch (e) {
                        console.warn('Error cleaning poop (hold):', e);
                    }
                }
                if (nearbyTask.progress >= nearbyTask.maxProgress) {
                    completeTask(nearbyTask.id);
                }
            }
        }
    }

    if (input.action) {
        input.action = false;
        const nearbyDoor = findNearbyDoor();
        const nearbyTask = findNearbyTask();
        const relaxSpot = checkRelaxSpot(gameState.dad.x, gameState.dad.y);
        const toiletSpot = checkToiletHiding(gameState.dad.x, gameState.dad.y);
        const mowerSpot = checkMower(gameState.dad.x, gameState.dad.y);
        // Priority order: exiting a special state > tasks > entering a special state > doors
        if (gameState.isRelaxing) {
            gameState.isRelaxing = false;
            gameState.relaxSpot = null;
        }
        else if (gameState.isHidingInToilet) {
            gameState.isHidingInToilet = false;
        }
        else if (nearbyTask) {
            if (nearbyTask.type === 'fetch') {
                completeTask(nearbyTask.id);
            } else if (nearbyTask.type === 'coverage') {
                nearbyTask.progress = Math.min(nearbyTask.maxProgress, nearbyTask.progress + 1);
                if (nearbyTask.name && nearbyTask.name.startsWith('Clean poop')) {
                    try {
                        const poop = findNearestEntity(gameState.dad.x, gameState.dad.y, 'poop', 200);
                        if (poop) removeEntity(poop);
                    } catch (e) {
                        console.warn('Error cleaning poop:', e);
                    }
                }
                if (nearbyTask.progress >= nearbyTask.maxProgress) {
                    completeTask(nearbyTask.id);
                }
            }
        }
        // Relax spot interaction
        else if (relaxSpot && !gameState.isRelaxing) {
            gameState.isRelaxing = true;
            gameState.relaxSpot = relaxSpot.key;
        }
        // Toilet hiding
        else if (toiletSpot && toiletSpot.canHide) {
            gameState.isHidingInToilet = !gameState.isHidingInToilet;
        }
        else if (nearbyDoor) {
            toggleDoor(nearbyDoor.index);
        }
        // Mower pickup/drop
        else if (mowerSpot) {
            gameState.dad.carrying = 'MOWER';
            notifyPlayer('Picked up mower.', 2.0);
        }
        else if (gameState.dad.carrying === 'MOWER') {
            gameState.dad.carrying = null;
            gameState.mower.x = gameState.dad.x + gameState.dad.width / 2 - gameState.mower.width / 2;
            gameState.mower.y = gameState.dad.y + gameState.dad.height / 2 - gameState.mower.height / 2;
            notifyPlayer('Dropped mower.', 2.0);
        }
    }

    // NPC Interaction (secondary interact button - R key)
    if (input.interact) {
        input.interact = false;
        const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
        const dadCenterY = gameState.dad.y + gameState.dad.height / 2;

        // Check for nearby NPCs
        for (let npcKey in gameState.npcStates) {
            const npc = gameState.npcStates[npcKey];
            if (!npc || !npc.x || !npc.y) continue;

            const dist = Math.hypot(dadCenterX - npc.x, dadCenterY - npc.y);
            if (dist < 80) {  // Interaction range
                // Generate NPC-specific dialogue when interacting
                const interactions = {
                    wife: ["Hey!", "What's up?", "Need something?"],
                    housemate: ["Yeah?", "What?", "Sup"],
                    baby: ["Goo goo!", "Cooing...", "Baby sounds!"],
                    brownDog: ["Woof!", "Pets!"],
                    blackDog: ["Bark!", "Friendly!"]
                };
                const key = npcKey === 'brownDog' ? 'dogs' : npcKey === 'blackDog' ? 'dogs' : npcKey;
                const lines = interactions[key] || ["..."];
                const line = lines[Math.floor(Math.random() * lines.length)];
                addDialogue(key, line, 2, npc.x, npc.y - 50);

                // Slight stress reduction from social interaction
                gameState.overstimulation = Math.max(0, gameState.overstimulation - 3);
                break;  // Only interact with closest NPC
            }
        }
    }

    // --- Overstimulation mechanics ---
    // All stress logic is consolidated in updateStressLogic() to avoid double-counting.
    // Coffee progress reset (must stay here as it depends on input state)
    if (!input.actionHeld || !checkCoffeeMachine(gameState.dad.x, gameState.dad.y)) {
        gameState.coffeeProgress = 0;
    }

    // Track peak stimulation
    gameState.stats.peakStimulation = Math.max(gameState.stats.peakStimulation, gameState.overstimulation);

    // Check overstimulation cap
    if (gameState.overstimulation >= MAX_OVERSTIMULATION) {
        endRunStormOff();
        return;
    }

    // Sprint energy management
    if (input.sprinting && (input.up || input.down || input.left || input.right)) {
        gameState.sprintergyLeft = Math.max(0, gameState.sprintergyLeft - 50 * effectiveDeltaTime);
        // Sprinting no longer adds extra stress; the baseline move rate already accounts for movement
    } else {
        gameState.sprintergyLeft = Math.min(gameState.maxSprintEnergy, gameState.sprintergyLeft + 30 * effectiveDeltaTime);
    }

    // Prevent sprinting when out of energy
    if (gameState.sprintergyLeft <= 0) {
        input.sprinting = false;
    }

    // Bark cooldown
    gameState.barkCooldown = Math.max(0, gameState.barkCooldown - effectiveDeltaTime);

    // Bark action (context-sensitive)
    if (input.bark && gameState.barkCooldown <= 0) {
        performBark();
        gameState.barkCooldown = gameState.barkCooldownMax;
    }

    // Update NPCs
    updateNPCs(effectiveDeltaTime);

    // Update timeline events (sprinkler, beer, chickens)
    updateTimeline(effectiveDeltaTime);

    // Update RNG events (dog barks, baby wakeup, toy spawning)
    updateRNGEvents(effectiveDeltaTime);

    // Update advanced stress logic
    updateStressLogic(effectiveDeltaTime);
    
    // Update camera (for toilet hiding zoom)
    updateCamera();

    // === CONTEXTUAL DIALOGUE TRIGGERS ===

    // Dad farts randomly
    if (Math.random() < 0.001) {
        addDialogue('dad', dialogueLines.dad.fart[0], 4);
        setTimeout(() => {
            addDialogue('dad', dialogueLines.dad.fartFollowup[0], 4);
        }, 2000);
    }

    // Dad surrounded by NPCs (dogs, kids, etc.)
    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    let nearbyCount = 0;
    for (let npc of Object.values(gameState.npcStates)) {
        if (npc && npc.x && npc.y) {
            const dist = Math.hypot(dadCenterX - npc.x, dadCenterY - npc.y);
            if (dist < 80) nearbyCount++;
        }
    }
    if (nearbyCount >= 3 && Math.random() < 0.002) {
        addDialogue('dad', dialogueLines.dad.surrounded[0], 6);
    }

    // Jake reacts to dad making coffee
    if (gameState.coffeeProgress > 0 && gameState.npcStates.housemate) {
        const jakeRoom = getRoom(gameState.npcStates.housemate);
        const dadRoom = getRoom(gameState.dad);
        if ((jakeRoom === 'KITCHEN' || jakeRoom === 'LIVING_ROOM') && Math.random() < 0.01) {
            addDialogue('jake', dialogueLines.jake.coffeeRequest[0], 5);
        }
    }

    // Random dog barking events (CAR! KANGAROO!)
    if (Math.random() < 0.0008) {
        // Piper barks at car/kangaroo
        if (Math.random() < 0.5) {
            addDialogue('piper', dialogueLines.piper.barkCar[0], 4);
        } else {
            addDialogue('piper', dialogueLines.piper.barkKangaroo[0], 4);
        }
    }

    if (Math.random() < 0.0008) {
        // Momo barks at car or is confused
        if (Math.random() < 0.5) {
            addDialogue('momo', dialogueLines.momo.barkCar[0], 4);
        } else {
            addDialogue('momo', dialogueLines.momo.barkConfused[0], 5);
        }
    }

    // Event tick
    gameState.lastEventTick += effectiveDeltaTime;
    if (gameState.lastEventTick >= gameState.eventTickInterval) {
        gameState.lastEventTick = 0;
        generateRandomTasks();
    }
}

function findNearbyTask() {
    const threshold = 120;
    let closest = null;
    let closestDist = threshold;

    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;

    for (let task of gameState.tasks) {
        const poi = getPOIByName(task.location);

        if (poi) {
            const dist = Math.hypot(
                dadCenterX - poi.x * TILE_SIZE,
                dadCenterY - poi.y * TILE_SIZE
            );
            if (dist < closestDist) {
                closestDist = dist;
                closest = task;
            }
        }
    }
    return closest;
}

// Push an entity out of any wall or closed door it's overlapping
function pushOutOfSolids(entity, width, height) {
    let pushed = true;
    let iterations = 0;
    while (pushed && iterations < 10) {
        pushed = false;
        iterations++;

        // Push out of walls (unless an open door covers the overlap)
        for (let wall of WALLS) {
            const wallX = wall.x * TILE_SIZE;
            const wallY = wall.y * TILE_SIZE;
            const wallW = wall.w * TILE_SIZE;
            const wallH = wall.h * TILE_SIZE;

            if (entity.x < wallX + wallW && entity.x + width > wallX &&
                entity.y < wallY + wallH && entity.y + height > wallY) {

                // Check if an open door covers this overlap
                let hasOpenDoor = false;
                for (let door of DOORS) {
                    if (!door.open) continue;
                    const doorRect = getDoorCollisionRect(door);
                    const doorX = doorRect.x;
                    const doorY = doorRect.y;
                    const doorW = doorRect.w;
                    const doorH = doorRect.h;
                    if (doorX < wallX + wallW && doorX + doorW > wallX &&
                        doorY < wallY + wallH && doorY + doorH > wallY &&
                        entity.x < doorX + doorW && entity.x + width > doorX &&
                        entity.y < doorY + doorH && entity.y + height > doorY) {
                        hasOpenDoor = true;
                        break;
                    }
                }
                if (hasOpenDoor) continue;

                // Find smallest push direction
                const overlapLeft = (wallX + wallW) - entity.x;
                const overlapRight = (entity.x + width) - wallX;
                const overlapTop = (wallY + wallH) - entity.y;
                const overlapBottom = (entity.y + height) - wallY;
                const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

                if (minOverlap === overlapLeft) entity.x = wallX + wallW;
                else if (minOverlap === overlapRight) entity.x = wallX - width;
                else if (minOverlap === overlapTop) entity.y = wallY + wallH;
                else entity.y = wallY - height;
                pushed = true;
            }
        }

        // Push out of closed doors
        for (let door of DOORS) {
            if (door.open) continue;
            const doorRect = getDoorCollisionRect(door);
            const doorX = doorRect.x;
            const doorY = doorRect.y;
            const doorW = doorRect.w;
            const doorH = doorRect.h;

            if (entity.x < doorX + doorW && entity.x + width > doorX &&
                entity.y < doorY + doorH && entity.y + height > doorY) {

                const overlapLeft = (doorX + doorW) - entity.x;
                const overlapRight = (entity.x + width) - doorX;
                const overlapTop = (doorY + doorH) - entity.y;
                const overlapBottom = (entity.y + height) - doorY;
                const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

                if (minOverlap === overlapLeft) entity.x = doorX + doorW;
                else if (minOverlap === overlapRight) entity.x = doorX - width;
                else if (minOverlap === overlapTop) entity.y = doorY + doorH;
                else entity.y = doorY - height;
                pushed = true;
            }
        }
    }
}

// --- Shared helper functions ---

function distBetween(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function getRoomAt(px, py) {
    let bestMatch = null;
    let bestArea = Infinity;

    for (const [key, room] of Object.entries(ROOMS)) {
        const rx = room.x * TILE_SIZE, ry = room.y * TILE_SIZE;
        const rw = room.w * TILE_SIZE, rh = room.h * TILE_SIZE;
        if (px >= rx && px < rx + rw && py >= ry && py < ry + rh) {
            const area = rw * rh;
            if (area < bestArea) {
                bestArea = area;
                bestMatch = key;
            }
        }
    }
    return bestMatch;
}

function randomPointInRoom(roomKey) {
    const r = ROOMS[roomKey];
    return {
        x: (r.x + 1 + Math.random() * (r.w - 2)) * TILE_SIZE,
        y: (r.y + 1 + Math.random() * (r.h - 2)) * TILE_SIZE
    };
}

// ---------------------------------------------------------
// PATH CLEAR CHECK (not visual LOS)
// Verifies the NPC's BODY can travel the whole segment.
// ---------------------------------------------------------
function hasLineOfSight(x1, y1, x2, y2, bodySize = 22) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.hypot(dx, dy);

    if (distance < 1) return true;

    // Step based on body size so we never "skip" collisions
    const STEP = bodySize * 0.5;

    const steps = Math.ceil(distance / STEP);
    const stepX = dx / steps;
    const stepY = dy / steps;

    let px = x1;
    let py = y1;

    for (let i = 0; i < steps; i++) {
        px += stepX;
        py += stepY;

        // IMPORTANT: we test using the NPC's REAL size,
        // not a tiny probe.
        if (
            !canMoveTo(px, py, bodySize, bodySize) ||
            !canPassDoor(px, py, bodySize, bodySize)
        ) {
            return false;
        }
    }

    return true;
}

function moveTowardPoint(npc, targetX, targetY, deltaTime, width, height) {
    width = width || 20;
    height = height || 20;
    const dx = targetX - npc.x;
    const dy = targetY - npc.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 10) return true;

    const speed = npc.moveSpeed * deltaTime;
    const newX = npc.x + (dx / dist) * speed;
    if (canMoveTo(newX, npc.y, width, height) && canPassDoor(newX, npc.y, width, height)) {
        npc.x = newX;
    }
    const newY = npc.y + (dy / dist) * speed;
    if (canMoveTo(npc.x, newY, width, height) && canPassDoor(npc.x, newY, width, height)) {
        npc.y = newY;
    }
    pushOutOfSolids(npc, width, height);
    return false;
}

function fleeFromPoint(npc, threatX, threatY, deltaTime, width, height) {
    width = width || 20;
    height = height || 20;
    const dx = npc.x - threatX;
    const dy = npc.y - threatY;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) { npc.x += (Math.random() - 0.5) * 10; return; }

    const speed = npc.moveSpeed * 1.5 * deltaTime;
    const newX = npc.x + (dx / dist) * speed;
    if (canMoveTo(newX, npc.y, width, height) && canPassDoor(newX, npc.y, width, height)) {
        npc.x = newX;
    }
    const newY = npc.y + (dy / dist) * speed;
    if (canMoveTo(npc.x, newY, width, height) && canPassDoor(npc.x, newY, width, height)) {
        npc.y = newY;
    }
    pushOutOfSolids(npc, width, height);
}


// ========================================
// SMART CHICKEN FLEE BEHAVIOR
// ========================================

function smartFleeFromPoint(chicken, threatX, threatY, deltaTime) {
    const width = 20;
    const height = 20;
    
    // Calculate direction away from threat
    const dx = chicken.x - threatX;
    const dy = chicken.y - threatY;
    const dist = Math.hypot(dx, dy);
    
    if (dist < 1) { 
        chicken.x += (Math.random() - 0.5) * 20;
        chicken.y += (Math.random() - 0.5) * 20;
        return;
    }
    
    const speed = chicken.moveSpeed * 1.5 * deltaTime;
    
    // Track if chicken is stuck
    if (!chicken.lastFleePos) {
        chicken.lastFleePos = { x: chicken.x, y: chicken.y };
        chicken.stuckCounter = 0;
    }
    
    const movedDist = Math.hypot(chicken.x - chicken.lastFleePos.x, chicken.y - chicken.lastFleePos.y);
    
    // If barely moved in last 0.5 seconds, chicken is stuck
    if (movedDist < 5 && chicken.stuckCounter > 0.5) {
        chicken.isStuck = true;
        chicken.stuckCounter = 0;
    }
    
    chicken.stuckCounter += deltaTime;
    
    // Update last position every 0.5 seconds
    if (chicken.stuckCounter > 0.5) {
        chicken.lastFleePos = { x: chicken.x, y: chicken.y };
        chicken.stuckCounter = 0;
    }
    
    // If stuck, use waypoints to find escape route
    if (chicken.isStuck || chicken.useWaypointEscape) {
        // Find nearest outdoor waypoint and flee there
        const outdoorWaypoints = ['CHICKEN_YARD', 'DOG_YARD', 'PATIO_STRIP', 'DOG_PATIO', 'CHICKEN_RUN'];
        let nearestWP = null;
        let nearestWPDist = Infinity;
        
        for (const wpName of outdoorWaypoints) {
            const wp = WAYPOINTS[wpName];
            if (wp) {
                const wpDist = Math.hypot(wp.pixelX - chicken.x, wp.pixelY - chicken.y);
                if (wpDist < nearestWPDist) {
                    nearestWPDist = wpDist;
                    nearestWP = wp;
                }
            }
        }
        
        if (nearestWP) {
            // Move toward escape waypoint
            const wpDx = nearestWP.pixelX - chicken.x;
            const wpDy = nearestWP.pixelY - chicken.y;
            const wpDist = Math.hypot(wpDx, wpDy);
            
            if (wpDist < 40) {
                // Reached waypoint, stop using waypoint escape
                chicken.isStuck = false;
                chicken.useWaypointEscape = false;
            } else {
                // Move toward waypoint
                const newX = chicken.x + (wpDx / wpDist) * speed;
                if (canMoveTo(newX, chicken.y, width, height) && canPassDoor(newX, chicken.y, width, height)) {
                    chicken.x = newX;
                }
                
                const newY = chicken.y + (wpDy / wpDist) * speed;
                if (canMoveTo(chicken.x, newY, width, height) && canPassDoor(chicken.x, newY, width, height)) {
                    chicken.y = newY;
                }
                
                pushOutOfSolids(chicken, width, height);
                chicken.useWaypointEscape = true;
                return;
            }
        }
    }
    
    // Normal flee: try primary direction (away from threat)
    const primaryX = chicken.x + (dx / dist) * speed;
    const primaryY = chicken.y + (dy / dist) * speed;
    
    let movedX = false;
    let movedY = false;
    
    if (canMoveTo(primaryX, chicken.y, width, height) && canPassDoor(primaryX, chicken.y, width, height)) {
        chicken.x = primaryX;
        movedX = true;
    }
    
    if (canMoveTo(chicken.x, primaryY, width, height) && canPassDoor(chicken.x, primaryY, width, height)) {
        chicken.y = primaryY;
        movedY = true;
    }
    
    // If blocked in primary direction, try perpendicular directions
    if (!movedX || !movedY) {
        // Try perpendicular directions (left/right relative to flee direction)
        const perpDx = -dy / dist; // Perpendicular to flee direction
        const perpDy = dx / dist;
        
        // Try both perpendicular directions
        const leftX = chicken.x + perpDx * speed;
        const leftY = chicken.y + perpDy * speed;
        const rightX = chicken.x - perpDx * speed;
        const rightY = chicken.y - perpDy * speed;
        
        // Choose whichever perpendicular direction is more open
        const leftOpen = canMoveTo(leftX, leftY, width, height) && canPassDoor(leftX, leftY, width, height);
        const rightOpen = canMoveTo(rightX, rightY, width, height) && canPassDoor(rightX, rightY, width, height);
        
        if (leftOpen && rightOpen) {
            // Both open - pick one randomly
            if (Math.random() < 0.5) {
                chicken.x = leftX;
                chicken.y = leftY;
            } else {
                chicken.x = rightX;
                chicken.y = rightY;
            }
        } else if (leftOpen) {
            chicken.x = leftX;
            chicken.y = leftY;
        } else if (rightOpen) {
            chicken.x = rightX;
            chicken.y = rightY;
        }
    }
    
    pushOutOfSolids(chicken, width, height);
}


function findNearestEntity(px, py, type, maxDist) {
    let closest = null, closestDist = maxDist || Infinity;
    for (const ent of gameState.entities) {
        if (ent.type !== type) continue;
        const d = Math.hypot(ent.x - px, ent.y - py);
        if (d < closestDist) { closestDist = d; closest = ent; }
    }
    return closest;
}

function removeEntity(ent) {
    const idx = gameState.entities.indexOf(ent);
    if (idx >= 0) gameState.entities.splice(idx, 1);
}

function getDoorCollisionRect(door) {
    const centerX = (door.x + door.w / 2) * TILE_SIZE;
    const centerY = (door.y + door.h / 2) * TILE_SIZE;
    const minThickness = 14;
    const minSpan = DAD_HITBOX_SIZE + 10;

    const width = door.orient === 'v'
        ? Math.max(door.w * TILE_SIZE, minThickness)
        : Math.max(door.w * TILE_SIZE, minSpan);
    const height = door.orient === 'v'
        ? Math.max(door.h * TILE_SIZE, minSpan)
        : Math.max(door.h * TILE_SIZE, minThickness);

    return {
        x: centerX - width / 2,
        y: centerY - height / 2,
        w: width,
        h: height
    };
}

function canMoveTo(x, y, width, height) {
    // Check against walls
    for (let wall of WALLS) {
        const wallX = wall.x * TILE_SIZE;
        const wallY = wall.y * TILE_SIZE;
        const wallW = wall.w * TILE_SIZE;
        const wallH = wall.h * TILE_SIZE;

        // AABB collision check — does the character overlap this wall?
        if (x < wallX + wallW && x + width > wallX &&
            y < wallY + wallH && y + height > wallY) {

            // Check if there's an open door that covers the character at this wall
            let hasOpenDoor = false;
            for (let door of DOORS) {
                if (!door.open) continue;

                const doorRect = getDoorCollisionRect(door);
                const doorX = doorRect.x;
                const doorY = doorRect.y;
                const doorW = doorRect.w;
                const doorH = doorRect.h;

                // Door must overlap both the wall AND the character
                if (doorX < wallX + wallW && doorX + doorW > wallX &&
                    doorY < wallY + wallH && doorY + doorH > wallY &&
                    x < doorX + doorW && x + width > doorX &&
                    y < doorY + doorH && y + height > doorY) {
                    hasOpenDoor = true;
                    break;
                }
            }

            if (!hasOpenDoor) {
                return false;
            }
        }
    }

    return true;
}

function canPassDoor(px, py, w, h) {
    for (let door of DOORS) {
        if (door.open) continue; // If open, ignore collision
        const doorRect = getDoorCollisionRect(door);
        const dx = doorRect.x;
        const dy = doorRect.y;
        const dw = doorRect.w;
        const dh = doorRect.h;

        if (px < dx + dw && px + w > dx && py < dy + dh && py + h > dy) {
            return false;
        }
    }
    return true;
}

// Find the closed door blocking movement at a given position
function findBlockingDoor(x, y, width, height) {
    for (let i = 0; i < DOORS.length; i++) {
        const door = DOORS[i];
        if (door.open) continue;
        const doorRect = getDoorCollisionRect(door);
        const doorX = doorRect.x;
        const doorY = doorRect.y;
        const doorW = doorRect.w;
        const doorH = doorRect.h;

        if (x < doorX + doorW && x + width > doorX &&
            y < doorY + doorH && y + height > doorY) {
            return i;
        }
    }
    return -1;
}

// Check if an NPC is near a door (within threshold pixels of its center)
function isNpcNearDoor(npc, doorIndex, threshold) {
    const door = DOORS[doorIndex];
    const doorCenterX = (door.x + door.w / 2) * TILE_SIZE;
    const doorCenterY = (door.y + door.h / 2) * TILE_SIZE;
    const npcCenterX = npc.x + 10; // npcWidth/2
    const npcCenterY = npc.y + 10;
    return Math.hypot(npcCenterX - doorCenterX, npcCenterY - doorCenterY) < threshold;
}

// Check if NPC has moved past a door (no longer overlapping it)
function isNpcPastDoor(npc, doorIndex, width, height) {
    const door = DOORS[doorIndex];
    const doorRect = getDoorCollisionRect(door);
    const doorX = doorRect.x;
    const doorY = doorRect.y;
    const doorW = doorRect.w;
    const doorH = doorRect.h;

    return !(npc.x < doorX + doorW && npc.x + width > doorX &&
             npc.y < doorY + doorH && npc.y + height > doorY);
}

function performBark() {
    const BARK_RADIUS = 150;
    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    
    // Spawn visual audio ring
    spawnAudioRing(dadCenterX, dadCenterY, BARK_RADIUS);
    
    // Check each NPC type and apply effects
    for (let npcKey in gameState.npcStates) {
        const npc = gameState.npcStates[npcKey];
        if (!npc) continue;
        
        const dist = Math.hypot(npc.x - dadCenterX, npc.y - dadCenterY);
        
        if (dist < BARK_RADIUS) {
            if (npcKey === 'brownDog' || npcKey === 'blackDog') {
                // Dogs get excited and run toward Dad (using pathfinding)
                npc.targetX = dadCenterX;
                npc.targetY = dadCenterY;
                npc.excitedTimer = 3.0; // Excited for 3 seconds
                npc.usePathfinding = true; // Flag to use pathfinding
            }
            else if (npcKey === 'baby') {
                // Baby gets attention, might cry
                npc.attention = true;
                npc.attentionTimer = 2.0;
            }
            else if (npcKey === 'wife' || npcKey === 'housemate') {
                // Wife/Jake head to the nearest task and boost it
                assignAdultHelp(npc, npcKey, dadCenterX, dadCenterY);
            }
        }
    }
    
    // Spook chickens in range
    if (gameState.chickens && Array.isArray(gameState.chickens)) {
        gameState.chickens.forEach(chicken => {
        const chickenDist = Math.hypot(chicken.x - dadCenterX, chicken.y - dadCenterY);
        if (chickenDist < BARK_RADIUS) {
            chicken.fleeTimer = 4.0;
            chicken.state = 'flee';
            chicken.isStuck = false; // Reset stuck flag
            chicken.useWaypointEscape = false; // Reset escape flag
            // Set threat position (not target position)
            chicken.targetX = dadCenterX;
            chicken.targetY = dadCenterY;
        }
    });
    }
    
    // Small stress increase for barking (it's loud!)
    gameState.overstimulation += 2.0;
}


function completeTask(taskId) {
    const taskIndex = gameState.tasks.findIndex(t => t.id === taskId);
    if (taskIndex > -1) {
        const task = gameState.tasks[taskIndex];
        recordPlaytestEvent('task_completed', { id: task.id, name: task.name, location: task.location, taskType: task.type });
        if (playtestBot.currentRun) {
            playtestBot.currentRun.completedTasks.push({
                time: Number(gameState.time.toFixed(2)),
                day: gameState.day,
                id: task.id,
                name: task.name,
                location: task.location,
                type: task.type
            });
        }
        gameState.tasks.splice(taskIndex, 1);
        gameState.stats.tasksCompleted++;

        // Reward varies by task type
        let reward = 10;
        if (task.type === 'hold') reward = 15;
        if (task.type === 'coverage') reward = 8;

        gameState.overstimulation = Math.max(0, gameState.overstimulation - reward);

        // Dad comments on task completion (varied)
        if (Math.random() < 0.4) {
            const line = dialogueLines.dad.taskComplete[Math.floor(Math.random() * dialogueLines.dad.taskComplete.length)];
            addDialogue('dad', line, 4);
        }

        if (task.name === 'MOVE SPRINKLER') {
            finishSprinklerEvent();
        }

        // Beer task completion - burp and review
        if (task.name === 'GET BEER') {
            gameState.beerClaimed = true;
            setTimeout(() => {
                addDialogue('dad', dialogueLines.dad.beer[0], 4);
            }, 500);
            setTimeout(() => {
                addDialogue('dad', dialogueLines.dad.beer[1], 6);
            }, 2500);
            setTimeout(() => {
                addDialogue('dad', dialogueLines.dad.beer[2], 6);
            }, 5000);
            // Random extra beer commentary
            if (Math.random() < 0.5) {
                setTimeout(() => {
                    const extra = dialogueLines.dad.beer[Math.floor(Math.random() * dialogueLines.dad.beer.length)];
                    addDialogue('dad', extra, 5);
                }, 7500);
            }
        }

        if (task.name === 'ROUND UP CHICKENS') {
            resolveChickenCurfew();
        }
    }
}

function generateRandomTasks() {
    // Base routine chores pool
    const routineChores = [
        { type: 'hold', name: 'Cuddle dogs', location: 'Couch', duration: 20 },
        { type: 'hold', name: 'Relax on couch', location: 'Couch', duration: 15 },
        { type: 'coverage', name: 'Vacuum living room', location: 'Vacuum', duration: 6 },
        { type: 'fetch', name: 'Refill dog water', location: 'Dog Bowls', duration: 0 },
    ];

    const poopCount = gameState.entities.filter(e => e.type === 'poop').length;
    const toyCount = gameState.entities.filter(e => e.type === 'toy').length;
    const stimLevel = gameState.overstimulation;
    const taskBacklog = gameState.tasks.length;

    // Debug: Log task generation checks
    if (!gameState.lastTaskLog) gameState.lastTaskLog = 0;
    gameState.lastTaskLog += 1;
    if (gameState.lastTaskLog >= 3) {
        gameState.lastTaskLog = 0;
        console.log(`[TASKS] Poop: ${poopCount} | Toys: ${toyCount} | Backlog: ${taskBacklog} | Stress: ${stimLevel.toFixed(1)}`);
    }

    // POOP CLEANUP - Generate based on actual poop buildup
    if (poopCount > 0) {
        const hasPoopTask = gameState.tasks.some(t => t.name && t.name.startsWith('Clean'));
        // More likely to generate if lots of poop
        const poopChance = Math.min(0.8, poopCount * 0.15);
        if (!hasPoopTask && Math.random() < poopChance && taskBacklog < 7 + gameState.day) {
            console.log(`[TASK SPAWN] Creating poop cleanup task (poop: ${poopCount})`);
            gameState.tasks.push(
                new Task(gameState.nextTaskId++, 'coverage', `Clean poop (${poopCount})`, 'Patio', 0, 0, poopCount)
            );
        }
    }

    // TOY CLEANUP - Generate based on actual toy buildup
    if (toyCount > 0) {
        const hasToyTask = gameState.tasks.some(t => t.name && t.name.startsWith('Collect'));
        const toyChance = Math.min(0.8, toyCount * 0.15);
        if (!hasToyTask && Math.random() < toyChance && taskBacklog < 7 + gameState.day) {
            console.log(`[TASK SPAWN] Creating toy cleanup task (toys: ${toyCount})`);
            gameState.tasks.push(
                new Task(gameState.nextTaskId++, 'coverage', `Collect toys (${toyCount})`, 'Toy Box', 0, 0, toyCount)
            );
        }
    }

    // ROUTINE CHORES - Spawn based on day and task backlog
    // Higher stress = more tasks (player is losing control)
    const stressMultiplier = 0.8 + (stimLevel / MAX_OVERSTIMULATION) * 1.2;
    const baseSpawnChance = 0.35 + gameState.day * 0.1;
    const spawnChance = baseSpawnChance * stressMultiplier;

    if (Math.random() < spawnChance && taskBacklog < 7 + gameState.day) {
        const chore = routineChores[Math.floor(Math.random() * routineChores.length)];
        console.log(`[TASK SPAWN] Creating routine chore: ${chore.name}`);
        gameState.tasks.push(
            new Task(gameState.nextTaskId++, chore.type, chore.name, chore.location, chore.duration, 0, chore.duration || 1)
        );
    }

    // WIFE-ASSIGNED TASKS - More likely when stress is high
    const wifeChores = [
        { type: 'coverage', name: 'Sweep kitchen', location: 'Sink', duration: 8 },
        { type: 'hold', name: 'Feed baby', location: 'Baby', duration: 25 },
        { type: 'fetch', name: 'Do dishes', location: 'Sink', duration: 0 },
        { type: 'hold', name: 'Play with baby', location: 'Baby', duration: 20 },
    ];

    const wifeChance = (0.15 + gameState.day * 0.05) * (1 + stimLevel / MAX_OVERSTIMULATION);
    if (Math.random() < wifeChance && taskBacklog < 7 + gameState.day) {
        const chore = wifeChores[Math.floor(Math.random() * wifeChores.length)];
        const alreadyExists = gameState.tasks.some(t => t.name === chore.name);
        if (!alreadyExists) {
            console.log(`[TASK SPAWN] Creating wife chore: ${chore.name}`);
            gameState.tasks.push(
                new Task(gameState.nextTaskId++, chore.type, chore.name, chore.location, chore.duration, 0, chore.duration || 1)
            );
        }
    }
}

// ===== RNG EVENT SYSTEM =====
const rngEvents = {
    dogBark: (dt) => {
        // Random chance for dogs to bark - stress inducing
        if (Math.random() < 0.0001 * gameState.day) {
            const dogs = [gameState.npcStates.brownDog, gameState.npcStates.blackDog];
            const dog = dogs[Math.floor(Math.random() * dogs.length)];
            if (dog) {
                spawnAudioRing(dog.x, dog.y, 150);
                gameState.overstimulation = Math.min(100, gameState.overstimulation + 3);
            }
        }
    },
    babyWakeup: (dt) => {
        // Random chance for baby to wake up early
        if (gameState.npcStates.baby && gameState.npcStates.baby.activity === 'sleeping' && Math.random() < 0.00008 * gameState.day) {
            gameState.npcStates.baby.activity = 'roaming';
            gameState.npcStates.baby.activityTimer = 0;
            spawnAudioRing(gameState.npcStates.baby.x, gameState.npcStates.baby.y, 100);
        }
    },
    toySpawn: (dt) => {
        // Random chance for toys to appear in living room
        const toyCount = gameState.entities.filter(e => e.type === 'toy').length;
        if (Math.random() < 0.00012 * gameState.day && toyCount < 5 + gameState.day) {
            const livingRoom = ROOMS.LIVING_ROOM;
            const toy = {
                type: 'toy',
                x: (livingRoom.x + 2 + Math.random() * (livingRoom.w - 4)) * TILE_SIZE,
                y: (livingRoom.y + 2 + Math.random() * (livingRoom.h - 4)) * TILE_SIZE
            };
            gameState.entities.push(toy);
        }
    }
};

// Update RNG events
function updateRNGEvents(dt) {
    rngEvents.dogBark(dt);
    rngEvents.babyWakeup(dt);
    rngEvents.toySpawn(dt);
}

function endDay() {
    recordPlaytestEvent('day_completed', {
        completedDay: gameState.day,
        tasksCompleted: gameState.stats.tasksCompleted,
        stress: Math.floor(gameState.overstimulation)
    });
    gameState.stats.daysCompleted++;

    if (gameState.day < DAYS) {
        gameState.day++;
        gameState.time = 0;
        gameState.eventTickInterval = Math.max(4, gameState.eventTickInterval - 0.5);
        gameState.overstimulation = Math.max(0, gameState.overstimulation - 20); // Reset some stress between days
        resetDayFlags();
        resetMowerState();
        setChickenRunGate(true);
        addInitialTasks();
        onNewDay(gameState.day);
        showModal(`DAY ${gameState.day}`, `Tasks completed: ${gameState.stats.tasksCompleted}\nStress level: ${Math.floor(gameState.overstimulation)}%\n\nGetting harder...`);
    } else {
        endRunSuccess();
    }
}

function onNewDay(day) {
    console.log(`[NEW DAY] Day ${day} started`);
    // Day 2: Munty + aggressive chickens join the chaos
    if (day === 2) {
        console.log(`[SPAWN] Spawning aggressive chickens and Munty`);
        spawnAggressiveChickens();
        spawnMunty();
    }
}

function spawnAggressiveChickens() {
    console.log(`[SPAWN] Creating aggressive chickens (Morag and Martha)`);
    const aggressiveNames = ['Morag', 'Martha'];
    for (let i = 0; i < 2; i++) {
        const pos = randomPointInRoom('CHICKEN_YARD');
        gameState.aggressiveChickens.push({
            x: pos.x, y: pos.y,
            moveSpeed: 50,
            state: 'patrol',
            stateTimer: 0,
            isLeader: false,
            aggressive: true,
            poopTimer: 5 + Math.random() * 8,
            targetX: pos.x, targetY: pos.y,
            fleeTimer: 0,
            name: aggressiveNames[i]
        });
        console.log(`[SPAWN] ${aggressiveNames[i]} spawned at x:${pos.x.toFixed(0)}, y:${pos.y.toFixed(0)}`);
    }
}

function spawnMunty() {
    console.log(`[SPAWN] Creating Munty (the ghost)`);
    gameState.npcStates.munty = {
        x: (ROOMS.LIVING_ROOM.x + 8) * TILE_SIZE,
        y: (ROOMS.LIVING_ROOM.y + 8) * TILE_SIZE,
        targetRoom: 'LIVING_ROOM',
        moveSpeed: 80, // Fast and chaotic
        vibrate: 0, // For pulsing effect
        canUseDoors: true,
        activity: 'roaming'
    };
    console.log(`[SPAWN] Munty spawned in LIVING_ROOM`);
}

function endRunSuccess() {
    gameState.isRunning = false;
    const stats = gameState.stats;
    finishPlaytestRun('success');
    showModal(
        'YOU SURVIVED!',
        `You made it through both days!\n\n` +
        `Tasks completed: ${stats.tasksCompleted}\n` +
        `Peak stress: ${Math.floor(stats.peakStimulation)}%\n` +
        `Days survived: ${stats.daysCompleted}\n\n` +
        `You need a vacation.`
    );
}

function endRunStormOff() {
    gameState.isRunning = false;
    const stats = gameState.stats;
    finishPlaytestRun('stormed_off');
    showModal(
        'YOU STORMED OFF',
        `Day ${gameState.day}: Overstimulated\n\n` +
        `Tasks completed: ${stats.tasksCompleted}\n` +
        `Peak stress: ${Math.floor(stats.peakStimulation)}%\n` +
        `Days survived: ${stats.daysCompleted}\n\n` +
        `You needed a break.`
    );
}

function showModal(title, text) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    const modalButton = document.getElementById('modal-button');

    modalTitle.textContent = title;
    modalText.textContent = text;
    modal.style.display = 'flex';
    modalButton.textContent = playtestBot.active && !gameState.isRunning ? 'RESET RUN' : 'CONTINUE';

    modalButton.onclick = () => {
        modal.style.display = 'none';
        if (!gameState.isRunning) {
            if (playtestBot.active) {
                restartPlaytestRun();
            } else {
                location.reload();
            }
        }
    };
}

function findNearbyDoor() {
    const threshold = 84;
    let closest = null;
    let closestScore = Infinity;

    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    const preferredDoorName = playtestBot.lastTargetDoorName || gameState.directPlayerIntentDoorName || null;
    const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const moveY = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const moveLength = Math.hypot(moveX, moveY);

    for (let i = 0; i < DOORS.length; i++) {
        const door = DOORS[i];
        const center = getDoorCenter(door);
        const rect = getDoorCollisionRect(door);
        const edgeDist = getDistanceToRectPoint(dadCenterX, dadCenterY, rect);
        if (edgeDist > threshold) {
            continue;
        }

        let score = edgeDist + Math.hypot(dadCenterX - center.x, dadCenterY - center.y) * 0.15;
        if (preferredDoorName && door.name === preferredDoorName) {
            score -= 18;
        }
        if (moveLength > 0) {
            const dirX = (center.x - dadCenterX) / Math.max(1, Math.hypot(center.x - dadCenterX, center.y - dadCenterY));
            const dirY = (center.y - dadCenterY) / Math.max(1, Math.hypot(center.x - dadCenterX, center.y - dadCenterY));
            const alignment = (dirX * moveX + dirY * moveY) / moveLength;
            score -= Math.max(0, alignment) * 12;
        }

        if (score < closestScore) {
            closestScore = score;
            closest = { ...door, index: i };
        }
    }
    return closest;
}

function toggleDoor(doorIndex) {
    if (doorIndex >= 0 && doorIndex < DOORS.length) {
        DOORS[doorIndex].open = !DOORS[doorIndex].open;
        if (playtestBot.currentRun) {
            playtestBot.currentRun.doorsToggled++;
        }
        recordPlaytestEvent('door_toggled', { name: DOORS[doorIndex].name, open: DOORS[doorIndex].open });
        // Opening or closing a door no longer directly modifies stress.  Stress is handled in the baseline model.

        // Push all characters out if they're now inside a closed door
        if (!DOORS[doorIndex].open) {
            pushOutOfSolids(gameState.dad, gameState.dad.width, gameState.dad.height);
            for (const npc of Object.values(gameState.npcStates)) {
                if (npc) {  // Check if NPC exists (munty is null until day 5)
                    pushOutOfSolids(npc, 20, 20);
                }
            }
        }
    }
}

// --- Chicken AI ---

// Get pixel coords of house-facing doors chickens are drawn to
function getHouseDoorPositions() {
    const doors = [];
    for (const door of DOORS) {
        if (door.name.includes('Patio') || door.name.includes('Dog patio')) {
            doors.push({ x: (door.x + door.w / 2) * TILE_SIZE, y: (door.y + door.h / 2) * TILE_SIZE, name: door.name });
        }
    }
    return doors;
}

function getNearestHuman(px, py) {
    const humans = [gameState.dad, gameState.npcStates.wife, gameState.npcStates.housemate];
    let closest = null, closestDist = Infinity;
    for (const h of humans) {
        const d = Math.hypot(h.x - px, h.y - py);
        if (d < closestDist) { closestDist = d; closest = h; }
    }
    return { target: closest, dist: closestDist };
}

function updateChicken(chicken, deltaTime, isAggressive) {
    const FLEE_RADIUS = 90; // 3 dad-lengths
    const AGGRO_FLEE_RADIUS = 120;

    chicken.stateTimer -= deltaTime;

    // Poop timer (not in coop, only on patio surfaces)
    if (chicken.state !== 'goto_coop') {
        const poopMultiplier = chicken.state === 'flee' ? 1.5 : 1.0;
        chicken.poopTimer -= deltaTime * poopMultiplier;
        if (chicken.poopTimer <= 0) {
            chicken.poopTimer = 6 + Math.random() * 14;
            // Only poop on patio surfaces (not in yards/coop/run)
            const chickenRoom = getRoomAt(chicken.x, chicken.y);
            if (chickenRoom === 'PATIO_MAIN' || chickenRoom === 'PATIO_STRIP' || chickenRoom === 'DOG_PATIO') {
                gameState.entities.push({ type: 'poop', x: chicken.x, y: chicken.y });
            }
        }
    }

    if (isAggressive) {
        updateAggressiveChicken(chicken, deltaTime);
        return;
    }

    switch (chicken.state) {
        case 'flock': {
            // Leader picks targets, followers trail leader
            const leader = gameState.chickens[0];

            if (chicken.isLeader) {
                // Pick a new target every 5-10 seconds
                if (chicken.stateTimer <= 0) {
                    if (Math.random() < 0.4) {
                        // Bias toward a house door
                        const doors = getHouseDoorPositions();
                        if (doors.length > 0) {
                            const door = doors[Math.floor(Math.random() * doors.length)];
                            chicken.targetX = door.x + (Math.random() - 0.5) * 40;
                            chicken.targetY = door.y + (Math.random() - 0.5) * 40;
                        }
                    } else {
                        const pt = randomPointInRoom('CHICKEN_YARD');
                        chicken.targetX = pt.x;
                        chicken.targetY = pt.y;
                    }
                    chicken.stateTimer = 5 + Math.random() * 5;
                }
            } else {
                // Follow leader with offset
                chicken.targetX = leader.x + (Math.random() - 0.5) * 40;
                chicken.targetY = leader.y + (Math.random() - 0.5) * 40;
            }

            moveTowardPoint(chicken, chicken.targetX, chicken.targetY, deltaTime);

            // Check for threats — humans
            const nearest = getNearestHuman(chicken.x, chicken.y);
            if (nearest.dist < FLEE_RADIUS) {
                chicken.state = 'flee';
                chicken.fleeTimer = 1.5 + Math.random();
                chicken.targetX = nearest.target.x;
                chicken.targetY = nearest.target.y;
                break;
            }

            // Check for aggressive chickens
            for (const aggro of gameState.aggressiveChickens) {
                if (distBetween(chicken, aggro) < AGGRO_FLEE_RADIUS) {
                    chicken.state = 'flee';
                    chicken.fleeTimer = 1.5 + Math.random();
                    chicken.targetX = aggro.x;
                    chicken.targetY = aggro.y;
                    break;
                }
            }

            // Random chance to visit coop
            if (Math.random() < 0.02 * deltaTime) {
                chicken.state = 'goto_coop';
                chicken.stateTimer = 3 + Math.random() * 5;
            }
            break;
        }

        case 'flee': {
            // Scatter away from threat — each chicken flees independently
            smartFleeFromPoint(chicken, chicken.targetX, chicken.targetY, deltaTime);
            chicken.fleeTimer -= deltaTime;
            if (chicken.fleeTimer <= 0) {
                chicken.state = 'flock';
                chicken.stateTimer = 0;
            }
            break;
        }

        case 'goto_coop': {
            const coopCenter = {
                x: (ROOMS.CHICKEN_COOP.x + ROOMS.CHICKEN_COOP.w / 2) * TILE_SIZE,
                y: (ROOMS.CHICKEN_COOP.y + ROOMS.CHICKEN_COOP.h / 2) * TILE_SIZE
            };
            moveTowardPoint(chicken, coopCenter.x, coopCenter.y, deltaTime);
            if (chicken.stateTimer <= 0) {
                chicken.state = 'flock';
                chicken.stateTimer = 0;
            }
            break;
        }
    }
}

function updateAggressiveChicken(chicken, deltaTime) {
    switch (chicken.state) {
        case 'patrol': {
            if (chicken.stateTimer <= 0) {
                if (Math.random() < 0.6) {
                    const doors = getHouseDoorPositions();
                    if (doors.length > 0) {
                        const door = doors[Math.floor(Math.random() * doors.length)];
                        chicken.targetX = door.x + (Math.random() - 0.5) * 40;
                        chicken.targetY = door.y + (Math.random() - 0.5) * 40;
                    }
                } else {
                    const pt = randomPointInRoom('CHICKEN_YARD');
                    chicken.targetX = pt.x;
                    chicken.targetY = pt.y;
                }
                chicken.stateTimer = 4 + Math.random() * 6;
            }
            moveTowardPoint(chicken, chicken.targetX, chicken.targetY, deltaTime);

            // Look for regular chickens to chase
            let nearestRegular = null, nearestDist = 150;
            for (const c of gameState.chickens) {
                const d = distBetween(chicken, c);
                if (d < nearestDist) { nearestDist = d; nearestRegular = c; }
            }
            if (nearestRegular) {
                chicken.state = 'chase';
                chicken.stateTimer = 3 + Math.random() * 2;
            }
            break;
        }

        case 'chase': {
            // Chase nearest regular chicken
            let target = null, targetDist = 200;
            for (const c of gameState.chickens) {
                const d = distBetween(chicken, c);
                if (d < targetDist) { targetDist = d; target = c; }
            }
            if (target) {
                const speed = chicken.moveSpeed;
                chicken.moveSpeed = speed * 1.3;
                moveTowardPoint(chicken, target.x, target.y, deltaTime);
                chicken.moveSpeed = speed;
            }
            if (chicken.stateTimer <= 0 || !target) {
                chicken.state = 'patrol';
                chicken.stateTimer = 0;
            }
            break;
        }
    }
}

function updateNPCs(deltaTime) {
    // Wife: custom AI
    updateWife(gameState.npcStates.wife, deltaTime);

    // Housemate (Jake): custom AI
    updateJake(gameState.npcStates.housemate, deltaTime);

    // Baby: custom AI
    updateBaby(gameState.npcStates.baby, deltaTime);

    // Dogs: custom AI
    updateMomo(gameState.npcStates.brownDog, deltaTime);
    updatePiper(gameState.npcStates.blackDog, deltaTime);
    if (gameState.npcStates.munty) updateMunty(gameState.npcStates.munty, deltaTime);

    // Chickens
    for (const chicken of gameState.chickens) updateChicken(chicken, deltaTime, false);
    for (const chicken of gameState.aggressiveChickens) updateChicken(chicken, deltaTime, true);
}

// --- Wife AI ---
function updateWife(wife, deltaTime) {
    // Check if wife was called by bark and should come help
    if (wife.helpingTimer > 0 && wife.targetX && wife.targetY) {
        const task = wife.helpTargetTaskId != null ? gameState.tasks.find(t => t.id === wife.helpTargetTaskId) : null;
        if (wife.helpTargetTaskId != null && !task) {
            clearAdultHelpState(wife);
        } else if (task) {
            const target = getTaskTargetPosition(task);
            if (target) {
                wife.targetX = target.x;
                wife.targetY = target.y;
            }
        }

        navigateToTarget(wife, wife.targetX, wife.targetY, deltaTime, 50);
        wife.helpingTimer -= deltaTime;
        if (wife.helpTargetTaskId != null) {
            const distanceToTask = Math.hypot(wife.x - wife.targetX, wife.y - wife.targetY);
            if (distanceToTask < 65) {
                applyTaskAssistance(wife.helpTargetTaskId, 'Wife');
                clearAdultHelpState(wife);
            }
        }

        if (wife.helpingTimer <= 0) {
            clearAdultHelpState(wife);
        }
        return;
    }

    // Relaxes on couch, roams house, sometimes goes to patios, cleans kitchen
    // Often productive but sometimes brings baby or adds to todo list without doing chore

    if (!wife.activity) wife.activity = 'roaming';
    if (!wife.activityTimer) wife.activityTimer = 0;

    wife.activityTimer -= deltaTime;

    if (wife.activityTimer <= 0) {
        // Pick new activity
        const roll = Math.random();
        if (roll < 0.3) {
            wife.activity = 'couch';
            wife.targetRoom = 'LIVING_ROOM';
            wife.activityTimer = 15 + Math.random() * 10;
        } else if (roll < 0.5) {
            wife.activity = 'kitchen';
            wife.targetRoom = 'KITCHEN';
            wife.activityTimer = 10 + Math.random() * 10;
        } else if (roll < 0.7) {
            wife.activity = 'patio';
            wife.targetRoom = Math.random() < 0.5 ? 'PATIO_MAIN' : 'PATIO_STRIP';
            wife.activityTimer = 8 + Math.random() * 7;
        } else {
            wife.activity = 'roaming';
            const rooms = ['KITCHEN', 'LIVING_ROOM', 'BABYS_ROOM', 'MASTER_BEDROOM'];
            wife.targetRoom = rooms[Math.floor(Math.random() * rooms.length)];
            wife.activityTimer = 5 + Math.random() * 5;
        }
    }

    moveNPC(wife, deltaTime, [wife.targetRoom || 'KITCHEN', 'LIVING_ROOM', 'KITCHEN', 'BABYS_ROOM']);
}

// --- Jake AI ---
function updateJake(jake, deltaTime) {
    // Check if jake was called by bark and should come help
    if (jake.helpingTimer > 0 && jake.targetX && jake.targetY) {
        const task = jake.helpTargetTaskId != null ? gameState.tasks.find(t => t.id === jake.helpTargetTaskId) : null;
        if (jake.helpTargetTaskId != null && !task) {
            clearAdultHelpState(jake);
        } else if (task) {
            const target = getTaskTargetPosition(task);
            if (target) {
                jake.targetX = target.x;
                jake.targetY = target.y;
            }
        }

        navigateToTarget(jake, jake.targetX, jake.targetY, deltaTime, 50);
        jake.helpingTimer -= deltaTime;
        if (jake.helpTargetTaskId != null) {
            const distanceToTask = Math.hypot(jake.x - jake.targetX, jake.y - jake.targetY);
            if (distanceToTask < 65) {
                applyTaskAssistance(jake.helpTargetTaskId, 'Jake');
                clearAdultHelpState(jake);
            }
        }

        if (jake.helpingTimer <= 0) {
            clearAdultHelpState(jake);
        }
        return;
    }

    // Usually in kitchen, couch, bedroom, or shed
    // Won't take baby if in bedroom or shed
    // Tidies up toys or kitchen when out

    if (!jake.activity) jake.activity = 'roaming';
    if (!jake.activityTimer) jake.activityTimer = 0;

    jake.activityTimer -= deltaTime;

    if (jake.activityTimer <= 0) {
        const roll = Math.random();
        if (roll < 0.25) {
            jake.activity = 'bedroom';
            jake.targetRoom = 'HOUSEMATE_ROOM';
            jake.activityTimer = 20 + Math.random() * 15;
        } else if (roll < 0.4) {
            jake.activity = 'shed';
            jake.targetRoom = 'SHED';
            jake.activityTimer = 15 + Math.random() * 10;
        } else if (roll < 0.6) {
            jake.activity = 'kitchen';
            jake.targetRoom = 'KITCHEN';
            jake.activityTimer = 10 + Math.random() * 8;
        } else {
            jake.activity = 'couch';
            jake.targetRoom = 'LIVING_ROOM';
            jake.activityTimer = 12 + Math.random() * 10;
        }
    }

    moveNPC(jake, deltaTime, [jake.targetRoom || 'KITCHEN', 'LIVING_ROOM', 'KITCHEN']);
}

// --- Baby AI ---
function updateBaby(baby, deltaTime) {
    // Very slow, roams, needs adult in room unless asleep in baby room
    // Will cry when player doesn't do what he wants

    if (!baby.activity) baby.activity = 'roaming';
    if (!baby.activityTimer) baby.activityTimer = 0;

    baby.activityTimer -= deltaTime;

    // Check if in baby room - can be alone if there
    const inBabyRoom = isInRoom(baby, 'BABYS_ROOM');

    if (baby.activityTimer <= 0) {
        const roll = Math.random();
        if (roll < 0.4 && inBabyRoom) {
            baby.activity = 'sleeping';
            baby.activityTimer = 30 + Math.random() * 20;
        } else {
            baby.activity = 'roaming';
            baby.targetRoom = Math.random() < 0.7 ? 'LIVING_ROOM' : 'BABYS_ROOM';
            baby.activityTimer = 8 + Math.random() * 7;
        }
    }

    // Baby moves very slowly
    const originalSpeed = baby.moveSpeed;
    baby.moveSpeed = 15; // Very slow
    moveNPC(baby, deltaTime, [baby.targetRoom || 'LIVING_ROOM', 'BABYS_ROOM', 'LIVING_ROOM']);
    baby.moveSpeed = originalSpeed;
}

// --- Dog AI ---
function updateMomo(momo, deltaTime) {
    // Check if dog was called by bark and should path to target
    if (momo.excitedTimer > 0 && momo.targetX && momo.targetY && momo.usePathfinding) {
        navigateToTarget(momo, momo.targetX, momo.targetY, deltaTime, 40);
        momo.excitedTimer -= deltaTime;
        if (momo.excitedTimer <= 0) {
            momo.usePathfinding = false;
        }
        return;
    }

    // Momo (brown) follows adults closely, avoids baby, gets excited when player interacts with baby/piper
    const dad = gameState.dad;
    const wife = gameState.npcStates.wife;
    const jake = gameState.npcStates.housemate;
    const baby = gameState.npcStates.baby;
    const piper = gameState.npcStates.blackDog;

    // Define people array for dog behavior (used below for closest adult tracking)
    const people = [{x: dad.x, y: dad.y}, wife, jake];

    // PRIORITY 1: Race to dog patio if anyone is near dog bowls
    const dogBowls = POIS.DOG_BOWLS;
    const bowlX = dogBowls.x * TILE_SIZE;
    const bowlY = dogBowls.y * TILE_SIZE;

    let someoneNearBowls = false;
    let closestPersonDist = Infinity;
    for (const person of people) {
        const distToBowl = Math.hypot(person.x - bowlX, person.y - bowlY);
        closestPersonDist = Math.min(closestPersonDist, distToBowl);
        if (distToBowl < 150) {
            someoneNearBowls = true;
            break;
        }
    }

    if (someoneNearBowls) {
        const originalSpeed = momo.moveSpeed;
        momo.moveSpeed *= 2.0; // 2x speed boost for Momo
        navigateToTarget(momo, bowlX, bowlY, deltaTime, 50);
        momo.moveSpeed = originalSpeed;
        return;
    }

    // PRIORITY 2: Go to kitchen if anyone is there
    const someoneInKitchen = isInRoom(wife, 'KITCHEN') || isInRoom(jake, 'KITCHEN') || isInRoom({x: dad.x, y: dad.y}, 'KITCHEN');
    if (someoneInKitchen) {
        momo.targetRoom = 'KITCHEN';
        moveNPC(momo, deltaTime, ['KITCHEN', 'LIVING_ROOM']);
        return;
    }

    // PRIORITY 3: Follow closest adult
    let closest = null;
    let closestDist = Infinity;
    for (const person of people) {
        const dist = Math.hypot(momo.x - person.x, momo.y - person.y);
        if (dist < closestDist) {
            closestDist = dist;
            closest = person;
        }
    }

    // If no humans nearby, stay near Piper
    if (closestDist > 300) {
        const distToPiper = Math.hypot(momo.x - piper.x, momo.y - piper.y);
        if (distToPiper > 60) {
            navigateToTarget(momo, piper.x, piper.y, deltaTime, 60);
            return;
        }
    }

    // Follow closely behind adults (within 40px)
    if (closest && closestDist > 40) {
        navigateToTarget(momo, closest.x, closest.y, deltaTime, 40);
    } else if (closest && closestDist < 20) {
        // Too close, back off slightly
        const dx = momo.x - closest.x;
        const dy = momo.y - closest.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
            moveTowardPoint(momo, momo.x + dx/dist * 10, momo.y + dy/dist * 10, deltaTime * 0.5);
        }
    } else {
        // No priority activity - just roam (especially outdoors if stuck there)
        if (!momo.roamTargetTimer) momo.roamTargetTimer = 5;
        momo.roamTargetTimer -= deltaTime;
        if (momo.roamTargetTimer <= 0) {
            momo.roamTargetTimer = 3 + Math.random() * 4;
            const currentRoom = getRoomAt(momo.x, momo.y) || 'LIVING_ROOM';
            momo.roamTarget = randomPointInRoom(currentRoom);
        }
        if (momo.roamTarget) {
            moveTowardPoint(momo, momo.roamTarget.x, momo.roamTarget.y, deltaTime * 0.8);
        }
    }
}

function updatePiper(piper, deltaTime) {
    // Check if dog was called by bark and should path to target
    if (piper.excitedTimer > 0 && piper.targetX && piper.targetY && piper.usePathfinding) {
        navigateToTarget(piper, piper.targetX, piper.targetY, deltaTime, 40);
        piper.excitedTimer -= deltaTime;
        if (piper.excitedTimer <= 0) {
            piper.usePathfinding = false;
        }
        return;
    }

    // Piper (black) is around kitchen (wants food), sometimes plays/sleeps/ignores barks
    // Won't blindly follow player outside
    const dad = gameState.dad;
    const wife = gameState.npcStates.wife;
    const jake = gameState.npcStates.housemate;

    // PRIORITY 1: Race to dog bowls if anyone is near them
    const dogBowls = POIS.DOG_BOWLS;
    const bowlX = dogBowls.x * TILE_SIZE;
    const bowlY = dogBowls.y * TILE_SIZE;
    const people = [{x: dad.x, y: dad.y}, wife, jake];

    let someoneNearBowls = false;
    let closestPersonDist = Infinity;
    for (const person of people) {
        if (!person) continue;
        const distToBowl = Math.hypot(person.x - bowlX, person.y - bowlY);
        closestPersonDist = Math.min(closestPersonDist, distToBowl);
        if (distToBowl < 150) {
            someoneNearBowls = true;
            break;
        }
    }

    if (someoneNearBowls) {
        const originalSpeed = piper.moveSpeed;
        piper.moveSpeed *= 2.0; // 2x speed boost for Piper
        navigateToTarget(piper, bowlX, bowlY, deltaTime, 50);
        piper.moveSpeed = originalSpeed;
        return;
    }

    // Initialize behavior state
    if (!piper.behaviorTimer) piper.behaviorTimer = 0;
    if (!piper.behavior) piper.behavior = 'kitchen';

    piper.behaviorTimer -= deltaTime;

    // Change behavior more frequently (every 3-8 seconds)
    if (piper.behaviorTimer <= 0) {
        const roll = Math.random();
        if (roll < 0.5) {
            piper.behavior = 'kitchen';
        } else if (roll < 0.75) {
            piper.behavior = 'sleep';
        } else {
            piper.behavior = 'ignore';
        }
        piper.behaviorTimer = 3 + Math.random() * 5;
    }

    // Execute behavior
    const someoneInKitchen = isInRoom(wife, 'KITCHEN') || isInRoom(jake, 'KITCHEN') || isInRoom({x: dad.x, y: dad.y}, 'KITCHEN');

    if (piper.behavior === 'kitchen' || someoneInKitchen) {
        piper.targetRoom = 'KITCHEN';
        moveNPC(piper, deltaTime, ['KITCHEN', 'LIVING_ROOM']);
    } else if (piper.behavior === 'sleep') {
        // Stay put (sleeping)
        return;
    } else {
        // Ignore - just roam slowly
        moveNPC(piper, deltaTime, ['KITCHEN', 'LIVING_ROOM', 'READING__DOG_ROOM']);
    }

    // Fallback: if stuck in a room with no roaming path (e.g., DOG_PATIO), wander locally
    const currentRoom = getRoomAt(piper.x, piper.y);
    if (!currentRoom || !['KITCHEN', 'LIVING_ROOM', 'READING__DOG_ROOM'].includes(currentRoom)) {
        if (!piper.localRoamTarget) {
            piper.localRoamTarget = randomPointInRoom(currentRoom || 'DOG_PATIO');
        }
        moveTowardPoint(piper, piper.localRoamTarget.x, piper.localRoamTarget.y, deltaTime * 0.7);
        if (Math.hypot(piper.x - piper.localRoamTarget.x, piper.y - piper.localRoamTarget.y) < 40) {
            piper.localRoamTarget = null; // Pick a new target
        }
    }
}

function updateMunty(munty, deltaTime) {
    // Munty (small black, vibrates, pulses red) - comes day 2
    // Howls when can't be near people (if locked outside)
    // Trips people over, upsets Jake/Wife/baby, won't stay still
    // Easily gets through fence, chases chickens, spawns poops
    // Doesn't listen to barks, makes mess inside

    munty.vibrate += deltaTime * 10;

    const dad = gameState.dad;
    const wife = gameState.npcStates.wife;
    const jake = gameState.npcStates.housemate;
    const baby = gameState.npcStates.baby;

    // Define people array for Munty behavior (used below for closest person tracking)
    const people = [{x: dad.x, y: dad.y}, wife, jake, baby];

    // PRIORITY 1: Race to dog patio if anyone is near dog bowls
    const dogBowls = POIS.DOG_BOWLS;
    const bowlX = dogBowls.x * TILE_SIZE;
    const bowlY = dogBowls.y * TILE_SIZE;

    let someoneNearBowls = false;
    for (const person of people) {
        const distToBowl = Math.hypot(person.x - bowlX, person.y - bowlY);
        if (distToBowl < 150) {
            someoneNearBowls = true;
            break;
        }
    }

    if (someoneNearBowls) {
        // Race to dog patio SUPER fast - allow multiple rooms for pathfinding
        const originalSpeed = munty.moveSpeed;
        munty.moveSpeed *= 2.5;
        munty.targetRoom = 'DOG_PATIO';
        moveNPC(munty, deltaTime, ['LIVING_ROOM', 'DOG_PATIO', 'MASTER_BEDROOM']);
        munty.moveSpeed = originalSpeed;
        return;
    }

    // Find nearest person
    let closest = null;
    let closestDist = Infinity;
    for (const person of people) {
        const dist = Math.hypot(munty.x - person.x, munty.y - person.y);
        if (dist < closestDist) {
            closestDist = dist;
            closest = person;
        }
    }

    // Always move toward nearest person chaotically
    if (closest) {
        // Add randomness to movement
        const jitterX = (Math.random() - 0.5) * 20;
        const jitterY = (Math.random() - 0.5) * 20;
        moveTowardPoint(munty, closest.x + jitterX, closest.y + jitterY, deltaTime * 1.5);
    } else {
        // No people nearby - roam chaotically
        moveNPC(munty, deltaTime, ['LIVING_ROOM', 'KITCHEN', 'DOG_YARD', 'CHICKEN_YARD']);
    }
}

// Helper: check if NPC is in a specific room
function isInRoom(npc, roomName) {
    const room = ROOMS[roomName];
    if (!room) return false;
    const roomX = room.x * TILE_SIZE;
    const roomY = room.y * TILE_SIZE;
    const roomW = room.w * TILE_SIZE;
    const roomH = room.h * TILE_SIZE;
    return npc.x >= roomX && npc.x <= roomX + roomW && npc.y >= roomY && npc.y <= roomY + roomH;
}

// Helper: move toward a room center
function moveTowardTarget(npc, room, deltaTime) {
    const targetX = (room.x + room.w / 2) * TILE_SIZE;
    const targetY = (room.y + room.h / 2) * TILE_SIZE;
    moveTowardPoint(npc, targetX, targetY, deltaTime);
}

// Helper: move toward a point


// ========================================
// WAYPOINT-BASED PATHFINDING SYSTEM
// ========================================
// NPCs navigate from waypoint to waypoint, not directly to targets

const WAYPOINTS = {
    // Interior doorways
    DOOR_ENSUITE_MASTER: makeDoorWaypoint('Ensuite → Master Bedroom', ['MASTER_BEDROOM', 'ENSUITE']),
    DOOR_MASTER_CORRIDOR_L: makeDoorWaypoint('Master Bedroom → Corridor (left)', ['MASTER_BEDROOM', 'CORRIDOR_LEFT']),
    DOOR_READING_CORRIDOR_L: makeDoorWaypoint('Reading → Corridor (left)', ['READING', 'CORRIDOR_LEFT']),
    DOOR_KITCHEN_CORRIDOR_L: makeDoorWaypoint('Kitchen → Corridor (left)', ['KITCHEN', 'CORRIDOR_LEFT']),
    DOOR_BABY_CORRIDOR_L: makeDoorWaypoint('Baby → Corridor (left)', ['BABYS_ROOM', 'CORRIDOR_LEFT']),
    DOOR_CORRIDOR_L_LIVING: makeDoorWaypoint('Corridor (left) → Living', ['CORRIDOR_LEFT', 'LIVING_ROOM']),
    DOOR_KITCHEN_LIVING: makeDoorWaypoint('Kitchen → Living', ['KITCHEN', 'LIVING_ROOM']),
    DOOR_LIVING_CORRIDOR_R: makeDoorWaypoint('Living → Corridor (right)', ['LIVING_ROOM', 'CORRIDOR_RIGHT']),
    DOOR_CORRIDOR_R_HOUSEMATE: makeDoorWaypoint('Corridor (right) → Housemate', ['CORRIDOR_RIGHT', 'HOUSEMATE_ROOM']),
    DOOR_CORRIDOR_R_OFFICE: makeDoorWaypoint('Corridor (right) → Office', ['CORRIDOR_RIGHT', 'HOME_OFFICE']),
    DOOR_CORRIDOR_R_SPARE: makeDoorWaypoint('Corridor (right) → Spare', ['CORRIDOR_RIGHT', 'SPARE_ROOM']),

    // Outdoor doorways
    DOOR_LIVING_PATIO: makeDoorWaypoint('Living → Patio', ['LIVING_ROOM', 'PATIO_MAIN']),
    DOOR_CORRIDOR_R_PATIO_STRIP: makeDoorWaypoint('Corridor (right) → Patio strip', ['CORRIDOR_RIGHT', 'PATIO_STRIP']),
    DOOR_LIVING_DOG_PATIO: makeDoorWaypoint('Living → Dog patio', ['LIVING_ROOM', 'DOG_PATIO']),
    DOOR_MASTER_DOG_PATIO: makeDoorWaypoint('Master → Dog patio', ['MASTER_BEDROOM', 'DOG_PATIO']),

    // Yard doorways
    DOOR_YARD_SHED: makeDoorWaypoint('Yard → Shed', ['DOG_YARD', 'SHED']),
    DOOR_RUN_COOP: makeDoorWaypoint('Run → Coop', ['CHICKEN_RUN', 'CHICKEN_COOP']),
    GATE_YARD_CHICKEN_RUN: makeDoorWaypoint('Yard → Chicken run (gate)', ['DOG_YARD', 'CHICKEN_RUN']),
    GATE_DOG_CHICKEN_TOP: makeDoorWaypoint('Dog Yard → Chicken Yard (top gate)', ['DOG_YARD', 'CHICKEN_YARD']),
    GATE_DOG_CHICKEN_BOTTOM: makeDoorWaypoint('Dog Yard → Chicken Yard (bottom gate)', ['DOG_YARD', 'CHICKEN_YARD']),

    DOG_YARD_TOP: makeWaypoint(OUTDOOR_LAYOUT.SPRINKLER.rawX, OUTDOOR_LAYOUT.SPRINKLER.rawY, ['DOG_YARD'], ['DOG_YARD']),

    // Room centers
    LIVING_ROOM: makeRoomWaypoint('LIVING_ROOM', ['DOOR_CORRIDOR_L_LIVING', 'DOOR_KITCHEN_LIVING', 'DOOR_LIVING_CORRIDOR_R', 'DOOR_LIVING_PATIO', 'DOOR_LIVING_DOG_PATIO']),
    KITCHEN: makeRoomWaypoint('KITCHEN', ['DOOR_KITCHEN_LIVING', 'DOOR_KITCHEN_CORRIDOR_L']),
    READING: makeRoomWaypoint('READING__DOG_ROOM', ['DOOR_READING_CORRIDOR_L']),
    CORRIDOR_LEFT: makeRoomWaypoint('CORRIDOR_LEFT', ['DOOR_CORRIDOR_L_LIVING', 'DOOR_MASTER_CORRIDOR_L', 'DOOR_READING_CORRIDOR_L', 'DOOR_KITCHEN_CORRIDOR_L', 'DOOR_BABY_CORRIDOR_L']),
    CORRIDOR_RIGHT: makeRoomWaypoint('CORRIDOR_RIGHT', ['DOOR_LIVING_CORRIDOR_R', 'DOOR_CORRIDOR_R_HOUSEMATE', 'DOOR_CORRIDOR_R_OFFICE', 'DOOR_CORRIDOR_R_SPARE', 'DOOR_CORRIDOR_R_PATIO_STRIP']),
    MASTER_BEDROOM: makeRoomWaypoint('MASTER_BEDROOM', ['DOOR_MASTER_CORRIDOR_L', 'DOOR_ENSUITE_MASTER', 'DOOR_MASTER_DOG_PATIO']),
    ENSUITE: makeRoomWaypoint('ENSUITE', ['DOOR_ENSUITE_MASTER']),
    BABYS_ROOM: makeRoomWaypoint('BABYS_ROOM', ['DOOR_BABY_CORRIDOR_L']),
    HOUSEMATE_ROOM: makeRoomWaypoint('HOUSEMATE_ROOM', ['DOOR_CORRIDOR_R_HOUSEMATE']),
    HOME_OFFICE: makeRoomWaypoint('HOME_OFFICE', ['DOOR_CORRIDOR_R_OFFICE']),
    SPARE_ROOM: makeRoomWaypoint('SPARE_ROOM', ['DOOR_CORRIDOR_R_SPARE']),
    PATIO_MAIN: makeRoomWaypoint('PATIO_MAIN', ['DOOR_LIVING_PATIO', 'CHICKEN_YARD']),
    PATIO_STRIP: makeRoomWaypoint('PATIO_STRIP', ['DOOR_CORRIDOR_R_PATIO_STRIP', 'CHICKEN_YARD']),
    DOG_PATIO: makeRoomWaypoint('DOG_PATIO', ['DOOR_LIVING_DOG_PATIO', 'DOOR_MASTER_DOG_PATIO', 'DOG_YARD']),
    DOG_YARD: makeRoomWaypoint('DOG_YARD', ['DOOR_YARD_SHED', 'GATE_YARD_CHICKEN_RUN', 'GATE_DOG_CHICKEN_TOP', 'GATE_DOG_CHICKEN_BOTTOM', 'DOG_PATIO', 'DOG_YARD_TOP']),
    CHICKEN_YARD: makeRoomWaypoint('CHICKEN_YARD', ['GATE_DOG_CHICKEN_TOP', 'GATE_DOG_CHICKEN_BOTTOM', 'PATIO_MAIN', 'PATIO_STRIP']),
    SHED: makeRoomWaypoint('SHED', ['DOOR_YARD_SHED']),
    CHICKEN_RUN: makeRoomWaypoint('CHICKEN_RUN', ['GATE_YARD_CHICKEN_RUN', 'DOOR_RUN_COOP']),
    CHICKEN_COOP: makeRoomWaypoint('CHICKEN_COOP', ['DOOR_RUN_COOP'])
};

// Convert waypoint coordinates to pixel coordinates
for (const key in WAYPOINTS) {
    const wp = WAYPOINTS[key];
    wp.pixelX = (wp.x + OFFSET_X) * TILE_SIZE;
    wp.pixelY = (wp.y + OFFSET_Y) * TILE_SIZE;
    wp.name = key;
}

// Find nearest waypoint to a position
function findNearestWaypoint(x, y, excludeWaypoints = []) {
    let nearest = null;
    let nearestDist = Infinity;
    
    for (const key in WAYPOINTS) {
        if (excludeWaypoints.includes(key)) continue;
        
        const wp = WAYPOINTS[key];
        const dist = Math.hypot(wp.pixelX - x, wp.pixelY - y);
        
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = key;
        }
    }
    
    return { waypoint: nearest, distance: nearestDist };
}

function isDoorWaypointName(waypointName) {
    return !!waypointName && (waypointName.startsWith('DOOR_') || waypointName.startsWith('GATE_'));
}

function waypointTouchesRoom(waypointName, roomKey) {
    if (!roomKey) return false;
    if (waypointName === roomKey) return true;
    const waypoint = WAYPOINTS[waypointName];
    return !!waypoint && Array.isArray(waypoint.rooms) && waypoint.rooms.includes(roomKey);
}

function getWaypointPathDistance(path) {
    if (!path || path.length < 2) return 0;

    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const current = WAYPOINTS[path[i]];
        const next = WAYPOINTS[path[i + 1]];
        if (!current || !next) continue;
        total += Math.hypot(next.pixelX - current.pixelX, next.pixelY - current.pixelY);
    }

    return total;
}

function getRoomWaypointPenalty(waypointName) {
    const waypoint = WAYPOINTS[waypointName];
    if (!waypoint || isDoorWaypointName(waypointName)) return 0;

    const connectionCount = waypoint.connections ? waypoint.connections.length : 0;
    if (connectionCount >= 4) return 72;
    if (connectionCount >= 3) return 24;
    return 8;
}

function getWaypointDirectionPenalty(x, y, waypoint, goalX, goalY) {
    if (typeof goalX !== 'number' || typeof goalY !== 'number') {
        return 0;
    }

    const targetDx = goalX - x;
    const targetDy = goalY - y;
    const targetDistance = Math.hypot(targetDx, targetDy);
    if (targetDistance < 80) {
        return 0;
    }

    const waypointDx = waypoint.pixelX - x;
    const waypointDy = waypoint.pixelY - y;
    const waypointDistance = Math.hypot(waypointDx, waypointDy);
    if (waypointDistance < 1) {
        return 0;
    }

    const alignment = ((targetDx * waypointDx) + (targetDy * waypointDy)) / (targetDistance * waypointDistance);
    return Math.max(0, 1 - alignment) * 90;
}

function getWaypointCandidatesForPosition(x, y, bodySize = DAD_HITBOX_SIZE, maxCandidates = 6, goalX = null, goalY = null) {
    const roomKey = getRoomAt(x, y);
    const candidates = [];

    for (const [waypointName, waypoint] of Object.entries(WAYPOINTS)) {
        const distance = Math.hypot(waypoint.pixelX - x, waypoint.pixelY - y);
        const visible = hasLineOfSight(x, y, waypoint.pixelX, waypoint.pixelY, bodySize);
        const inSameRoom = waypointTouchesRoom(waypointName, roomKey);
        const isRoomCenter = waypointName === roomKey;
        const score = distance
            + (isDoorWaypointName(waypointName) ? 18 : 0)
            + (visible ? 0 : 120)
            + (inSameRoom ? 0 : 80)
            + (isRoomCenter ? getRoomWaypointPenalty(waypointName) : 0)
            + getWaypointDirectionPenalty(x, y, waypoint, goalX, goalY);

        candidates.push({
            waypoint: waypointName,
            distance,
            score,
            visible,
            inSameRoom,
            isRoomCenter
        });
    }

    candidates.sort((a, b) => a.score - b.score || a.distance - b.distance);

    const selected = [];
    const seen = new Set();
    const sameRoomCandidates = candidates.filter(candidate => candidate.inSameRoom);

    for (const candidate of sameRoomCandidates) {
        if (candidate.isRoomCenter || seen.has(candidate.waypoint)) continue;
        selected.push(candidate);
        seen.add(candidate.waypoint);
        if (selected.length >= maxCandidates) break;
    }

    if (selected.length < maxCandidates) {
        const roomCenterCandidate = sameRoomCandidates.find(candidate => candidate.isRoomCenter);
        if (roomCenterCandidate && !seen.has(roomCenterCandidate.waypoint)) {
            selected.push(roomCenterCandidate);
            seen.add(roomCenterCandidate.waypoint);
        }
    }

    for (const candidate of candidates) {
        if (seen.has(candidate.waypoint)) continue;
        selected.push(candidate);
        seen.add(candidate.waypoint);
        if (selected.length >= maxCandidates) break;
    }

    return selected;
}

function findBestWaypointRoute(startX, startY, targetX, targetY, options = {}) {
    const bodySize = options.bodySize || DAD_HITBOX_SIZE;
    const routeContext = options.routeContext || null;
    const rawStartCandidates = getWaypointCandidatesForPosition(startX, startY, bodySize, 6, targetX, targetY);
    const rawEndCandidates = getWaypointCandidatesForPosition(targetX, targetY, bodySize, 4, startX, startY);
    const startCandidates = rawStartCandidates.some(candidate => candidate.inSameRoom)
        ? rawStartCandidates.filter(candidate => candidate.inSameRoom)
        : rawStartCandidates;
    const endCandidates = rawEndCandidates.some(candidate => candidate.inSameRoom)
        ? rawEndCandidates.filter(candidate => candidate.inSameRoom)
        : rawEndCandidates;

    let bestRoute = null;

    for (const startCandidate of startCandidates) {
        for (const endCandidate of endCandidates) {
            const path = findWaypointPath(startCandidate.waypoint, endCandidate.waypoint, routeContext);
            if (!path || path.length === 0) continue;

            const totalScore = startCandidate.score + endCandidate.score + getWaypointPathDistance(path);
            if (!bestRoute || totalScore < bestRoute.score) {
                bestRoute = {
                    score: totalScore,
                    startWaypoint: startCandidate.waypoint,
                    endWaypoint: endCandidate.waypoint,
                    waypoints: path
                };
            }
        }
    }

    if (bestRoute) {
        return bestRoute;
    }

    const start = findNearestWaypoint(startX, startY, []);
    const end = findNearestWaypoint(targetX, targetY, []);
    if (!start.waypoint || !end.waypoint) return null;

    const fallbackPath = findWaypointPath(start.waypoint, end.waypoint, routeContext);
    if (!fallbackPath || fallbackPath.length === 0) return null;

    return {
        score: getWaypointPathDistance(fallbackPath),
        startWaypoint: start.waypoint,
        endWaypoint: end.waypoint,
        waypoints: fallbackPath
    };
}

function getWaypointReachThreshold(waypointName, bodySize = DAD_HITBOX_SIZE) {
    if (isDoorWaypointName(waypointName)) {
        const door = getDoorForWaypointName(waypointName);
        if (door) {
            const doorRect = getDoorCollisionRect(door);
            const doorwayThickness = door.orient === 'v' ? doorRect.w : doorRect.h;
            return Math.max(30, bodySize / 2 + doorwayThickness / 2 + 10);
        }
        return Math.max(30, bodySize + 2);
    }

    return Math.max(72, bodySize + 32);
}

function hasReachedWaypoint(waypointName, x, y, bodySize = DAD_HITBOX_SIZE) {
    const waypoint = WAYPOINTS[waypointName];
    if (!waypoint) return true;
    return Math.hypot(x - waypoint.pixelX, y - waypoint.pixelY) < getWaypointReachThreshold(waypointName, bodySize);
}

// Find path between two waypoints using breadth-first search
// Helper function to check if a waypoint requires passing through a door, and if that door is accessible
function isWaypointAccessible(waypointName, npc) {
    // If it's a door waypoint, check if the door is open or if NPC can open it
    if (waypointName.startsWith('DOOR_') || waypointName.startsWith('GATE_')) {
        // Find the corresponding door in DOORS array
        const doorWP = WAYPOINTS[waypointName];
        if (!doorWP) return true; // If waypoint doesn't exist, allow it

        // Find door by checking if any door is at or near this waypoint position
        const door = DOORS.find(d => {
            const doorCenterX = (d.x + d.w / 2) * TILE_SIZE;
            const doorCenterY = (d.y + d.h / 2) * TILE_SIZE;
            const dist = Math.hypot(doorCenterX - doorWP.pixelX, doorCenterY - doorWP.pixelY);
            return dist < 30; // Within 30px of door center
        });

        if (!door) return true; // No door found, allow passage

        // If door is open, always allow
        if (door.open) return true;

        // If door is closed, only allow if NPC can open doors
        return npc.canUseDoors === true;
    }

    // Not a door waypoint, always accessible
    return true;
}

function findWaypointPath(startWaypoint, endWaypoint, npc = null) {
    if (startWaypoint === endWaypoint) {
        return [startWaypoint];
    }

    const queue = [[startWaypoint]];
    const visited = new Set([startWaypoint]);

    while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];

        const wp = WAYPOINTS[current];
        if (!wp) continue;

        for (const neighbor of wp.connections) {
            if (visited.has(neighbor)) continue;

            // Check if this waypoint is accessible based on door states and NPC abilities
            if (npc && !isWaypointAccessible(neighbor, npc)) {
                continue; // Skip this connection if door is closed and NPC can't open it
            }

            const newPath = [...path, neighbor];

            if (neighbor === endWaypoint) {
                return newPath;
            }

            visited.add(neighbor);
            queue.push(newPath);
        }
    }

    // No path found - return empty to indicate no valid path
    return null;
}

// Main waypoint navigation function for NPCs
function navigateToTarget(npc, targetX, targetY, deltaTime, stopDistance = 30) {
    const dist = Math.hypot(targetX - npc.x, targetY - npc.y);

    // If very close to target, just move directly
    if (dist <= stopDistance) {
        npc.waypointPath = null;
        npc.currentWaypointIndex = 0;
        return;
    }

    // If close enough and have line of sight, move directly
    if (dist < 100 && hasLineOfSight(npc.x, npc.y, targetX, targetY, npc.size || 14)) {
        moveDirectly(npc, targetX, targetY, deltaTime, stopDistance);
        return;
    }

    // Track if NPC is making progress to detect being stuck
    if (npc.lastPathPosition === undefined) {
        npc.lastPathPosition = { x: npc.x, y: npc.y, checkTime: 0 };
    }

    // Check if stuck (not moved much in last 2 seconds)
    npc.lastPathPosition.checkTime -= deltaTime;
    let isStuck = false;
    if (npc.lastPathPosition.checkTime <= 0) {
        const distMoved = Math.hypot(npc.x - npc.lastPathPosition.x, npc.y - npc.lastPathPosition.y);
        isStuck = distMoved < 20; // Moved less than 20px in 2 seconds = stuck
        npc.lastPathPosition = { x: npc.x, y: npc.y, checkTime: 2.0 };
    }

    // Check if we need a new waypoint path
    const needNewPath = !npc.waypointPath ||
                        !npc.waypointTarget ||
                        Math.hypot(npc.waypointTarget.x - targetX, npc.waypointTarget.y - targetY) > 50 ||
                        isStuck; // Only recalculate if actually stuck
    
    if (needNewPath) {
        // Find nearest waypoint to NPC
        const startWP = findNearestWaypoint(npc.x, npc.y);
        // Find nearest waypoint to target
        const endWP = findNearestWaypoint(targetX, targetY);
        
        // Find path through waypoints (considering door states and NPC abilities)
        npc.waypointPath = findWaypointPath(startWP.waypoint, endWP.waypoint, npc);
        npc.currentWaypointIndex = 0;
        npc.waypointTarget = { x: targetX, y: targetY };

        // If no valid path found, clear path and stop
        if (!npc.waypointPath) {
            npc.waypointPath = null;
            npc.waypointTarget = null;
            return; // Can't reach target - all paths blocked
        }
    }

    // Follow waypoint path
    if (npc.waypointPath && npc.waypointPath.length > 0) {
        const currentWPIndex = npc.currentWaypointIndex || 0;
        
        // Check if we've reached all waypoints
        if (currentWPIndex >= npc.waypointPath.length) {
            // Move directly to final target
            moveDirectly(npc, targetX, targetY, deltaTime, stopDistance);
            return;
        }
        
        const currentWPName = npc.waypointPath[currentWPIndex];
        const currentWP = WAYPOINTS[currentWPName];

        if (!currentWP) {
            // Invalid waypoint, clear path
            npc.waypointPath = null;
            return;
        }

        // Safety check: if next waypoint in path is a door that's now closed and NPC can't open it, clear path
        if (!isWaypointAccessible(currentWPName, npc)) {
            npc.waypointPath = null;
            npc.waypointTarget = null;
            return; // Path is now blocked
        }

        const wpDist = Math.hypot(currentWP.pixelX - npc.x, currentWP.pixelY - npc.y);
        
        // If close to current waypoint, move to next
        if (wpDist < 30) {
            npc.currentWaypointIndex = currentWPIndex + 1;
            return; // Let next frame handle movement to next waypoint
        }
        
        // Move toward current waypoint
        moveDirectly(npc, currentWP.pixelX, currentWP.pixelY, deltaTime, 20);
    }
}

// Move directly toward a point (used by waypoint navigation)
function moveDirectly(npc, targetX, targetY, deltaTime, stopDistance = 10) {
    const dx = targetX - npc.x;
    const dy = targetY - npc.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist <= stopDistance) return;
    
    const moveSpeed = npc.moveSpeed * deltaTime;
    const npcWidth = 20;
    const npcHeight = 20;
    
    if (dist > 0) {
        // Try moving in X direction
        const newX = npc.x + (dx / dist) * moveSpeed;
        if (canMoveTo(newX, npc.y, npcWidth, npcHeight)) {
            if (canPassDoor(newX, npc.y, npcWidth, npcHeight)) {
                npc.x = newX;
            } else if (npc.canUseDoors && !npc.doorInteraction) {
                // Blocked by closed door - open it!
                const blockedDoor = findBlockingDoor(newX, npc.y, npcWidth, npcHeight);
                if (blockedDoor >= 0) {
                    npc.doorInteraction = { doorIndex: blockedDoor, wasOpen: DOORS[blockedDoor].open };
                    DOORS[blockedDoor].open = true;
                    npc.x = newX; // Now move through
                }
            }
        }
        
        // Try moving in Y direction
        const newY = npc.y + (dy / dist) * moveSpeed;
        if (canMoveTo(npc.x, newY, npcWidth, npcHeight)) {
            if (canPassDoor(npc.x, newY, npcWidth, npcHeight)) {
                npc.y = newY;
            } else if (npc.canUseDoors && !npc.doorInteraction) {
                // Blocked by closed door - open it!
                const blockedDoor = findBlockingDoor(npc.x, newY, npcWidth, npcHeight);
                if (blockedDoor >= 0) {
                    npc.doorInteraction = { doorIndex: blockedDoor, wasOpen: DOORS[blockedDoor].open };
                    DOORS[blockedDoor].open = true;
                    npc.y = newY; // Now move through
                }
            }
        }
    }
    
    pushOutOfSolids(npc, npcWidth, npcHeight);
}

function moveTowardPoint(npc, tx, ty, deltaTime) {
    const dx = tx - npc.x;
    const dy = ty - npc.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 10) return;

    const moveSpeed = npc.moveSpeed * deltaTime;
    const npcWidth = 20;
    const npcHeight = 20;

    const newX = npc.x + (dx / dist) * moveSpeed;
    if (canMoveTo(newX, npc.y, npcWidth, npcHeight) && canPassDoor(newX, npc.y, npcWidth, npcHeight)) {
        npc.x = newX;
    }

    const newY = npc.y + (dy / dist) * moveSpeed;
    if (canMoveTo(npc.x, newY, npcWidth, npcHeight) && canPassDoor(npc.x, newY, npcWidth, npcHeight)) {
        npc.y = newY;
    }

    pushOutOfSolids(npc, npcWidth, npcHeight);
}

function moveNPC(npc, deltaTime, allowedRooms) {
    const npcWidth = 20;
    const npcHeight = 20;
    
    // If this NPC has an active door interaction, check if they've passed through
    if (npc.doorInteraction) {
        if (isNpcPastDoor(npc, npc.doorInteraction.doorIndex, npcWidth, npcHeight)) {
            // NPC has passed through the door — decide whether to restore original state
            const di = npc.doorInteraction;
            // ~75-80% chance to restore original state, ~20-25% chance to leave it opposite
            if (Math.random() < 0.225) {
                // Leave the door in the opposite state (it's currently open, so leave it open)
                // — the "opposite" of what they'd normally do
                DOORS[di.doorIndex].open = !di.wasOpen;
            } else {
                // Restore original state
                DOORS[di.doorIndex].open = di.wasOpen;
            }
            npc.doorInteraction = null;
        }
    }
    
    // Special case: Momo (brownDog) follows Piper (blackDog) if too far apart
    if (npc === gameState.npcStates.brownDog) {
        const piperPos = gameState.npcStates.blackDog;
        const distToPiper = Math.hypot(npc.x - piperPos.x, npc.y - piperPos.y);
        if (distToPiper > 60) {
            // Momo follows Piper using waypoint navigation
            navigateToTarget(npc, piperPos.x, piperPos.y, deltaTime, 60);
            return;
        }
    }
    
    // Randomly change target room occasionally
    if (Math.random() < 0.01) {
        npc.targetRoom = allowedRooms[Math.floor(Math.random() * allowedRooms.length)];
    }
    
    // Get target room bounds
    const targetRoom = ROOMS[npc.targetRoom];
    if (!targetRoom) return;
    const targetX = (targetRoom.x + targetRoom.w / 2) * TILE_SIZE;
    const targetY = (targetRoom.y + targetRoom.h / 2) * TILE_SIZE;
    
    // Use smart waypoint-based pathfinding instead of direct movement
    navigateToTarget(npc, targetX, targetY, deltaTime, 10);
    
}

// Notification system
function notifyPlayer(message, duration = 3.0) {
    console.log(`[NOTIFICATION] ${message}`);
    gameState.notification = { message, timeLeft: duration };
}

function setChickenRunGate(open) {
    const giantGate = DOORS.find(d => d.name && d.name.includes('Chicken run (gate)'));
    if (giantGate) giantGate.open = open;
}

function finishSprinklerEvent() {
    gameState.sprinklerMoved = true;
    gameState.sprinklerActive = false;
    if (gameState.timeline.activeSprinklerTrigger !== null) {
        gameState.timeline.nextSprinklerIndex++;
    }
    gameState.timeline.activeSprinklerTrigger = null;
    notifyPlayer("Sprinkler moved.");
}

function startSprinklerEvent(triggerTime) {
    gameState.timeline.activeSprinklerTrigger = triggerTime;
    gameState.sprinklerMoved = false;
    gameState.sprinklerActive = true;
    gameState.sprinkler.x = POIS.SPRINKLER.x * TILE_SIZE;
    gameState.sprinkler.y = POIS.SPRINKLER.y * TILE_SIZE;
    addTaskIfMissing('MOVE SPRINKLER', 'Sprinkler', 'fetch');
    notifyPlayer('MOVE SPRINKLER!');
}

function startBeerEvent() {
    gameState.timeline.beerTaskSpawned = true;
    addTaskIfMissing('GET BEER', 'Beer', 'fetch');
    notifyPlayer('Beer window is open.');
}

function herdChickensHome(dt) {
    const runCenter = {
        x: (ROOMS.CHICKEN_RUN.x + ROOMS.CHICKEN_RUN.w / 2) * TILE_SIZE,
        y: (ROOMS.CHICKEN_RUN.y + ROOMS.CHICKEN_RUN.h / 2) * TILE_SIZE
    };

    for (const chicken of gameState.chickens) {
        chicken.state = 'goto_coop';
        chicken.stateTimer = Math.max(chicken.stateTimer || 0, 1.5);
        chicken.targetX = runCenter.x;
        chicken.targetY = runCenter.y;
        moveTowardPoint(chicken, runCenter.x, runCenter.y, dt * 1.25);
    }

    for (const chicken of gameState.aggressiveChickens) {
        chicken.targetX = runCenter.x;
        chicken.targetY = runCenter.y;
        moveTowardPoint(chicken, runCenter.x, runCenter.y, dt * 1.1);
    }
}

function resolveChickenCurfew() {
    const secureChicken = (chicken, roomKey, state) => {
        const pos = randomPointInRoom(roomKey);
        chicken.x = pos.x;
        chicken.y = pos.y;
        chicken.targetX = pos.x;
        chicken.targetY = pos.y;
        chicken.state = state;
        chicken.stateTimer = 0;
    };

    for (const chicken of gameState.chickens) {
        secureChicken(chicken, Math.random() < 0.75 ? 'CHICKEN_RUN' : 'CHICKEN_COOP', 'flock');
    }

    for (const chicken of gameState.aggressiveChickens) {
        secureChicken(chicken, 'CHICKEN_RUN', 'patrol');
    }

    setChickenRunGate(false);
    gameState.chickensLocked = true;
    notifyPlayer('Chickens secured.');
}

function startChickenCurfew() {
    gameState.timeline.chickenCurfewStarted = true;
    setChickenRunGate(true);
    addTaskIfMissing('ROUND UP CHICKENS', 'Chicken Run', 'fetch');
    notifyPlayer('Round up the chickens.');
}

// Timeline event system
function updateTimeline(dt) {
    const time = gameState.time;
    const nextSprinklerTime = SPRINKLER_SCHEDULE[gameState.timeline.nextSprinklerIndex];

    if (nextSprinklerTime !== undefined && time >= nextSprinklerTime && gameState.timeline.activeSprinklerTrigger === null) {
        startSprinklerEvent(nextSprinklerTime);
    }

    if (gameState.timeline.activeSprinklerTrigger !== null &&
        time >= gameState.timeline.activeSprinklerTrigger + 15 &&
        !gameState.sprinklerMoved) {
        gameState.overstimulation += 2.0 * dt;
    }

    if (time >= BEER_TIME && !gameState.beerClaimed && !gameState.timeline.beerTaskSpawned) {
        startBeerEvent();
    }

    if (time >= CHICKEN_CURFEW_TIME && !gameState.timeline.chickenCurfewStarted) {
        startChickenCurfew();
    }

    if (gameState.timeline.chickenCurfewStarted && !gameState.chickensLocked) {
        herdChickensHome(dt);
    }

    if (time >= CHICKEN_PANIC_TIME && !gameState.chickensLocked) {
        gameState.overstimulation += 3.0 * dt;
    }
}

// Advanced stress logic
function updateStressLogic(dt) {
    const incompleteTasks = gameState.tasks.filter(t => t.progress < t.maxProgress).length;
    const totalPressureItems = gameState.tasks.length + gameState.entities.length;
    const isMoving = input.up || input.down || input.left || input.right;
    const isStandingStill = !isMoving;

    // Coffee buff countdown
    if (gameState.coffeeBuff) {
        gameState.coffeeBuffTimer -= dt;
        if (gameState.coffeeBuffTimer <= 0) {
            gameState.coffeeBuff = false;
        }
    }

    // --- STRESS RATE CALCULATION ---
    let stressRate = 0;

    // 1. Movement stress: moving around increases stress
    if (isMoving) {
        stressRate += BASE_MOVE_RATE;
    }

    // 2. Task pressure: incomplete tasks create ambient stress
    const taskPressure = incompleteTasks / (5 + gameState.day);
    stressRate += EXTRA_TASK_STRESS_RATE * taskPressure;

    // 2.5. Proximity stress: Dogs and baby nearby increase stress
    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    const proximityThreshold = 150; // pixels

    let proximityStress = 0;
    let momoNearby = false;
    let piperNearby = false;
    let babyNearby = false;

    // Check Momo (brown dog) - ALWAYS stressful when nearby
    if (gameState.npcStates.brownDog) {
        const distToMomo = Math.hypot(
            gameState.npcStates.brownDog.x - dadCenterX,
            gameState.npcStates.brownDog.y - dadCenterY
        );
        if (distToMomo < proximityThreshold) {
            momoNearby = true;
            proximityStress += 0.3; // Momo alone adds 0.3 stress/sec (velcro dog)
        }
    }

    // Check Piper (black dog) - only stressful in combinations
    if (gameState.npcStates.blackDog) {
        const distToPiper = Math.hypot(
            gameState.npcStates.blackDog.x - dadCenterX,
            gameState.npcStates.blackDog.y - dadCenterY
        );
        if (distToPiper < proximityThreshold) {
            piperNearby = true;
            // Piper alone: no stress
            // Piper with others: stress added below in combinations
        }
    }

    // Check Baby - only stressful in combinations
    if (gameState.npcStates.baby) {
        const distToBaby = Math.hypot(
            gameState.npcStates.baby.x - dadCenterX,
            gameState.npcStates.baby.y - dadCenterY
        );
        if (distToBaby < proximityThreshold) {
            babyNearby = true;
            // Baby alone: no stress
            // Baby with others: stress added below in combinations
        }
    }

    // Stress for combinations (Piper and Baby only stressful together with something else)
    const totalNearby = (momoNearby ? 1 : 0) + (piperNearby ? 1 : 0) + (babyNearby ? 1 : 0);

    if (momoNearby && piperNearby && babyNearby) {
        // Momo + Piper + Baby - maximum chaos
        proximityStress += 0.35; // Extra 0.35 stress/sec (total: 0.3 + 0.35 = 0.65)
    } else if (momoNearby && piperNearby) {
        // Momo + Piper - both dogs nearby
        proximityStress += 0.25; // Extra 0.25 stress/sec (total: 0.3 + 0.25 = 0.55)
    } else if (momoNearby && babyNearby) {
        // Momo + Baby - dog and baby together
        proximityStress += 0.2; // Extra 0.2 stress/sec (total: 0.3 + 0.2 = 0.5)
    } else if (piperNearby && babyNearby) {
        // Piper + Baby only - they need at least 2 to be stressful
        proximityStress += 0.25; // 0.25 stress/sec (Piper's share: 0.15, Baby's share: 0.1)
    }

    stressRate += proximityStress;

    // 3. Stress REDUCTION based on what player is doing
    if (gameState.isHidingInToilet) {
        const toiletCheck = checkToiletHiding(gameState.dad.x, gameState.dad.y);
        if (toiletCheck && toiletCheck.doorClosed) {
            stressRate -= 3.0; // Door closed = maximum privacy
        } else {
            stressRate -= 1.5; // Door open = less effective
        }
    } else if (gameState.isRelaxing) {
        stressRate -= 2.0; // Furniture relaxation
    } else if (isStandingStill) {
        if (totalPressureItems < 2) {
            // Can only calm down when there isn't much to do
            stressRate -= BASE_STILL_RATE;
            if (input.actionHeld) {
                stressRate -= BASE_EXTRA_CALM_RATE;
            }
        }
        // If lots to do, standing still gives no relief (but doesn't add stress)
    }

    // 4. Coffee buff passive reduction
    if (gameState.coffeeBuff) {
        stressRate -= 0.3;
    }

    // Apply stress change
    const oldStress = gameState.overstimulation;
    gameState.overstimulation += stressRate * dt;
    gameState.overstimulation = Math.max(0, Math.min(100, gameState.overstimulation));

    // Debug logging for stress changes (every 2 seconds approximately)
    if (!gameState.lastStressLog) gameState.lastStressLog = 0;
    gameState.lastStressLog += dt;
    if (gameState.lastStressLog >= 2.0) {
        gameState.lastStressLog = 0;
        const proximityParts = [];
        if (momoNearby) proximityParts.push('Momo');
        if (piperNearby) proximityParts.push('Piper');
        if (babyNearby) proximityParts.push('Baby');
        const proximityInfo = proximityParts.length > 0 ? ` | Proximity: ${proximityParts.join('+') || 'none'}` : '';
        console.log(`[STRESS] Rate: ${stressRate.toFixed(2)}/s | Current: ${gameState.overstimulation.toFixed(1)}/100 | Moving: ${isMoving} | Standing still: ${isStandingStill} | Tasks: ${incompleteTasks}${proximityInfo}`);
    }
}


// Audio ring visual effect system
function spawnAudioRing(x, y, maxRadius) {
    gameState.audioRings.push({
        x: x, y: y,
        r: 10,
        maxR: maxRadius,
        alpha: 1.0
    });
}

// Helper function for smooth interpolation
function lerp(start, end, t) {
    return start + (end - start) * t;
}

function getCameraFocus() {
    return {
        x: gameState.dad.x + gameState.dad.width / 2,
        y: gameState.dad.y + gameState.dad.height / 2
    };
}

function worldToScreen(x, y) {
    return {
        x: x * gameState.cameraScale + gameState.cameraOffsetX,
        y: y * gameState.cameraScale + gameState.cameraOffsetY
    };
}

// Draw world objects (furniture, etc)
function drawWorldObjects() {
    for (let key in WORLD_OBJECTS) {
        let obj = WORLD_OBJECTS[key];

        const objX = (obj.x + OFFSET_X) * TILE_SIZE;
        const objY = (obj.y + OFFSET_Y) * TILE_SIZE;
        const objW = obj.w * TILE_SIZE;
        const objH = obj.h * TILE_SIZE;

        ctx.fillStyle = obj.color;
        ctx.fillRect(objX, objY, objW, objH);

        if (obj.accent) {
            const insetX = Math.max(3, objW * 0.12);
            const insetY = Math.max(3, objH * 0.12);
            ctx.fillStyle = obj.accent;
            ctx.fillRect(objX + insetX, objY + insetY, Math.max(4, objW - insetX * 2), Math.max(4, objH - insetY * 2));
        }

        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(objX, objY, objW, objH);

        // Special: If Sprinkler is placed, draw its AOE
        if (key === 'SPRINKLER' && gameState.sprinklerActive) {
            ctx.beginPath();
            ctx.arc(objX, objY, 80, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(0, 150, 255, 0.15)";
            ctx.fill();
        }
    }
}

// Camera system with zoom
function updateCamera() {
    const focus = getCameraFocus();
    const targetScale = gameState.isHidingInToilet ? 4.0 : 1.0;
    const cameraLerp = gameState.isHidingInToilet ? 0.25 : 0.15;
    
    // Smoothly lerp camera zoom and position
    gameState.cameraScale = lerp(gameState.cameraScale, targetScale, cameraLerp);
    
    // Adjust offset to keep player centered
    const targetOffsetX = GAME_WIDTH / 2 - focus.x * gameState.cameraScale;
    const targetOffsetY = GAME_HEIGHT / 2 - focus.y * gameState.cameraScale;
    
    gameState.cameraOffsetX = lerp(gameState.cameraOffsetX, targetOffsetX, cameraLerp);
    gameState.cameraOffsetY = lerp(gameState.cameraOffsetY, targetOffsetY, cameraLerp);
}

// Toilet vignette effect
// ===== CANVAS-BASED HUD (Screen Space) =====
function drawHUD() {
    ctx.save();

    // === TOP-LEFT: Day & Time ===
    const dayBoxX = 10;
    const dayBoxY = 10;
    const dayBoxW = 200;
    const dayBoxH = 50;

    // Background box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(dayBoxX, dayBoxY, dayBoxW, dayBoxH);
    ctx.strokeStyle = '#4db8ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(dayBoxX, dayBoxY, dayBoxW, dayBoxH);

    // Day label
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#4db8ff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const dayText = DEBUG_MODE ? `DAY ${gameState.day} [DEBUG]` : `DAY ${gameState.day}`;
    ctx.fillText(dayText, dayBoxX + 10, dayBoxY + 8);

    // Time label
    const minutes = Math.floor(gameState.time / 60);
    const seconds = Math.floor(gameState.time % 60);
    const timeText = `TIME: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    ctx.font = '14px monospace';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(timeText, dayBoxX + 10, dayBoxY + 28);

    // === TOP-CENTER: Timed Event Notification ===
    if (gameState.notification) {
        const noticeW = 320;
        const noticeH = 42;
        const noticeX = (GAME_WIDTH - noticeW) / 2;
        const noticeY = 10;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
        ctx.fillRect(noticeX, noticeY, noticeW, noticeH);
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 3;
        ctx.strokeRect(noticeX, noticeY, noticeW, noticeH);

        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = '#ffcc00';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(gameState.notification.message, noticeX + noticeW / 2, noticeY + noticeH / 2);
    }

    // === TOP-RIGHT: Overstimulation Meter ===
    const meterX = GAME_WIDTH - 260;
    const meterY = 10;
    const meterW = 250;
    const meterH = 90;

    // Background box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(meterX, meterY, meterW, meterH);
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3;
    ctx.strokeRect(meterX, meterY, meterW, meterH);

    // Label
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#ff6b6b';
    ctx.textAlign = 'center';
    ctx.fillText('OVERSTIMULATION', meterX + meterW / 2, meterY + 12);

    // Meter bar background
    const barX = meterX + 10;
    const barY = meterY + 28;
    const barW = meterW - 20;
    const barH = 20;
    ctx.fillStyle = '#222';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Meter fill
    const meterPercent = Math.min(gameState.overstimulation / MAX_OVERSTIMULATION, 1.0);
    const fillW = barW * meterPercent;
    const gradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    gradient.addColorStop(0, '#ffcc00');
    gradient.addColorStop(1, '#ff6b6b');
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, fillW, barH);

    // Percentage text
    ctx.font = '14px monospace';
    ctx.fillStyle = '#ffcc00';
    ctx.textAlign = 'center';
    ctx.fillText(Math.floor(meterPercent * 100) + '%', meterX + meterW / 2, meterY + 62);

    // === TOP-RIGHT (below meter): Tasks Panel ===
    const tasksX = GAME_WIDTH - 290;
    const tasksY = 110;
    const tasksW = 280;
    const maxTasksDisplay = 6;
    const taskItemH = 45;
    const tasksH = 40 + (Math.min(gameState.tasks.length, maxTasksDisplay) * taskItemH);

    // Background box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
    ctx.fillRect(tasksX, tasksY, tasksW, tasksH);
    ctx.strokeStyle = '#4db8ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(tasksX, tasksY, tasksW, tasksH);

    // Title
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#4db8ff';
    ctx.textAlign = 'left';
    ctx.fillText('TASKS', tasksX + 10, tasksY + 12);

    // Draw horizontal line under title
    ctx.strokeStyle = '#4db8ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tasksX + 10, tasksY + 25);
    ctx.lineTo(tasksX + tasksW - 10, tasksY + 25);
    ctx.stroke();

    // Task items
    let taskYPos = tasksY + 32;
    for (let i = 0; i < Math.min(gameState.tasks.length, maxTasksDisplay); i++) {
        const task = gameState.tasks[i];

        // Task item background
        ctx.fillStyle = 'rgba(77, 184, 255, 0.1)';
        ctx.fillRect(tasksX + 5, taskYPos, tasksW - 10, taskItemH - 2);

        // Left border
        ctx.fillStyle = '#4db8ff';
        ctx.fillRect(tasksX + 5, taskYPos, 3, taskItemH - 2);

        // Task type icon
        const typeIcon = task.type === 'fetch' ? '📦' : task.type === 'hold' ? '⏱️' : '🧹';
        ctx.font = '12px monospace';
        ctx.fillStyle = '#ffcc00';
        ctx.textAlign = 'left';
        ctx.fillText(typeIcon + ' ' + task.name, tasksX + 12, taskYPos + 12);

        // Location and progress
        let progressStr = '';
        if (task.type === 'coverage' || task.type === 'hold') {
            progressStr = ` ${Math.floor(task.progress)}/${task.maxProgress}`;
        }
        ctx.font = '10px monospace';
        ctx.fillStyle = '#aaa';
        ctx.fillText(task.location + progressStr, tasksX + 12, taskYPos + 28);

        taskYPos += taskItemH;
    }

    // === BOTTOM-RIGHT: Sprint Energy Bar ===
    const sprintX = GAME_WIDTH - 190;
    const sprintY = GAME_HEIGHT - 70;
    const sprintW = 180;
    const sprintH = 60;

    // Background box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(sprintX, sprintY, sprintW, sprintH);
    ctx.strokeStyle = '#66ff66';
    ctx.lineWidth = 2;
    ctx.strokeRect(sprintX, sprintY, sprintW, sprintH);

    // Label
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#66ff66';
    ctx.textAlign = 'left';
    ctx.fillText('SPRINT ENERGY', sprintX + 8, sprintY + 12);

    // Sprint bar background
    const sprintBarX = sprintX + 8;
    const sprintBarY = sprintY + 22;
    const sprintBarW = sprintW - 16;
    const sprintBarH = 12;
    ctx.fillStyle = '#222';
    ctx.fillRect(sprintBarX, sprintBarY, sprintBarW, sprintBarH);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(sprintBarX, sprintBarY, sprintBarW, sprintBarH);

    // Sprint fill
    const sprintPercent = gameState.sprintergyLeft / gameState.maxSprintEnergy;
    const sprintFillW = sprintBarW * sprintPercent;
    const sprintGradient = ctx.createLinearGradient(sprintBarX, 0, sprintBarX + sprintBarW, 0);
    sprintGradient.addColorStop(0, '#66ff66');
    sprintGradient.addColorStop(1, '#66cc66');
    ctx.fillStyle = sprintGradient;
    ctx.fillRect(sprintBarX, sprintBarY, sprintFillW, sprintBarH);

    // Percentage text
    ctx.font = '10px monospace';
    ctx.fillStyle = '#66ff66';
    ctx.textAlign = 'center';
    ctx.fillText(Math.floor(sprintPercent * 100) + '%', sprintX + sprintW / 2, sprintY + 46);

    // === BOTTOM-LEFT: Coffee Buff & Status Text ===
    let statusY = GAME_HEIGHT - 20;

    // Coffee buff indicator
    if (gameState.coffeeBuff) {
        const coffeeTimeLeft = Math.ceil(gameState.coffeeBuffTimer);
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = '#ffcc00';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';

        // Draw with black outline for visibility
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeText(`☕ ${coffeeTimeLeft}s`, 15, statusY);
        ctx.fillText(`☕ ${coffeeTimeLeft}s`, 15, statusY);

        statusY -= 25;
    }

    // Status text
    let statusText = '';
    if (gameState.isRelaxing) {
        statusText = 'Relaxing...';
    } else if (gameState.isHidingInToilet) {
        statusText = 'Hiding in toilet...';
    } else if (gameState.dad.carrying === 'MOWER') {
        statusText = 'Mowing lawn...';
    }

    if (statusText) {
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = '#4db8ff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';

        // Draw with black outline for visibility
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeText(statusText, 15, statusY);
        ctx.fillText(statusText, 15, statusY);
    }

    ctx.restore();
}

function drawToiletVignette() {
    if (!gameState.isHidingInToilet) return;
    
    // Create a radial gradient that clears a small circle around the player
    let grad = ctx.createRadialGradient(
        GAME_WIDTH / 2, GAME_HEIGHT / 2, 50, // Inner circle
        GAME_WIDTH / 2, GAME_HEIGHT / 2, 300 // Outer circle
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.95)'); // Almost pitch black
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

// Draw blueprint-style floorplan
function drawFloorplan() {
    // 1. Draw Rooms (Blueprint Style)
    for (let key in ROOMS) {
        let room = ROOMS[key];
        ctx.fillStyle = room.color;
        ctx.fillRect(room.x * TILE_SIZE, room.y * TILE_SIZE, room.w * TILE_SIZE, room.h * TILE_SIZE);
        
        // Draw Room Label
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.font = "12px monospace";
        ctx.fillText(room.name, room.x * TILE_SIZE + 5, room.y * TILE_SIZE + 15);
    }
    
    // 2. Draw Static Objects (Blueprint Furniture)
    Object.values(WORLD_OBJECTS).forEach(obj => {
        ctx.fillStyle = obj.color;
        ctx.fillRect((obj.x + OFFSET_X) * TILE_SIZE, (obj.y + OFFSET_Y) * TILE_SIZE, obj.w * TILE_SIZE, obj.h * TILE_SIZE);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        ctx.strokeRect((obj.x + OFFSET_X) * TILE_SIZE, (obj.y + OFFSET_Y) * TILE_SIZE, obj.w * TILE_SIZE, obj.h * TILE_SIZE);
    });
}

// Draw only the primary interactable that Dad will act on with E
function drawAOECircles() {
    const dadX = gameState.dad.x + gameState.dad.width / 2;
    const dadY = gameState.dad.y + gameState.dad.height / 2;
    const interactionRadius = 50 * gameState.cameraScale;

    // Determine what would be interacted with if E is pressed (priority order):
    // 1. Task at nearby location
    // 2. Relax spot (couch, bed)
    // 3. Toilet
    // 4. Coffee machine

    // Check for nearby task
    const nearbyTask = findNearbyTask();
    if (nearbyTask) {
        const poi = getPOIByName(nearbyTask.location);
        if (poi) {
            const screen = worldToScreen(poi.x * TILE_SIZE, poi.y * TILE_SIZE);
            ctx.fillStyle = 'rgba(100, 255, 100, 0.2)';
            ctx.strokeStyle = 'rgba(100, 255, 100, 0.8)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, interactionRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        return; // Don't check other interactables if task is nearby
    }

    // Check for relax spot
    const relaxSpot = checkRelaxSpot(gameState.dad.x, gameState.dad.y);
    if (relaxSpot) {
        const objCenterX = (relaxSpot.obj.x + OFFSET_X + relaxSpot.obj.w / 2) * TILE_SIZE;
        const objCenterY = (relaxSpot.obj.y + OFFSET_Y + relaxSpot.obj.h / 2) * TILE_SIZE;
        const screen = worldToScreen(objCenterX, objCenterY);
        ctx.fillStyle = 'rgba(100, 150, 255, 0.2)';
        ctx.strokeStyle = 'rgba(100, 150, 255, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, interactionRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        return; // Don't check other interactables if relax spot is nearby
    }

    // Check for toilet
    const toiletCheck = checkToiletHiding(gameState.dad.x, gameState.dad.y);
    if (toiletCheck) {
        const toilet = WORLD_OBJECTS.TOILET;
        const toiletCenterX = (toilet.x + OFFSET_X + toilet.w / 2) * TILE_SIZE;
        const toiletCenterY = (toilet.y + OFFSET_Y + toilet.h / 2) * TILE_SIZE;
        const screen = worldToScreen(toiletCenterX, toiletCenterY);
        ctx.fillStyle = 'rgba(200, 100, 255, 0.2)';
        ctx.strokeStyle = 'rgba(200, 100, 255, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, interactionRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        return;
    }

    // Check for coffee machine
    const coffee = WORLD_OBJECTS.COFFEE_MACHINE;
    if (coffee) {
        const coffeeCenterX = (coffee.x + OFFSET_X + coffee.w / 2) * TILE_SIZE;
        const coffeeCenterY = (coffee.y + OFFSET_Y + coffee.h / 2) * TILE_SIZE;
        const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
        const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
        const dist = Math.hypot(coffeeCenterX - dadCenterX, coffeeCenterY - dadCenterY);
        if (dist < 150) {
            const screen = worldToScreen(coffeeCenterX, coffeeCenterY);
            ctx.fillStyle = 'rgba(200, 150, 100, 0.2)';
            ctx.strokeStyle = 'rgba(200, 150, 100, 0.8)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, interactionRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            return;
        }
    }
}

// Draw sprinkler area of effect (legacy)
function drawSprinkler() {
    if (!gameState.sprinklerActive) return;

    ctx.beginPath();
    ctx.arc(gameState.sprinkler.x, gameState.sprinkler.y, 80, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 150, 255, 0.15)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 150, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
}

// Render

// ========================================
// FEATURE PATCH: INTERACTION HELPERS
// ========================================

function checkRelaxSpot(x, y) {
    // Check if Dad is near a relax-type world object
    const INTERACT_DIST = 120;  // Increased from 40 for easier interaction

    for (let key in WORLD_OBJECTS) {
        let obj = WORLD_OBJECTS[key];
        if (obj.type !== 'relax') continue;

        const objCenterX = (obj.x + OFFSET_X + obj.w / 2) * TILE_SIZE;
        const objCenterY = (obj.y + OFFSET_Y + obj.h / 2) * TILE_SIZE;
        const dadCenterX = x + gameState.dad.width / 2;
        const dadCenterY = y + gameState.dad.height / 2;

        const dist = Math.hypot(objCenterX - dadCenterX, objCenterY - dadCenterY);
        if (dist < INTERACT_DIST) {
            return { key: key, obj: obj };
        }
    }
    return null;
}

function checkToiletHiding(x, y) {
    const INTERACT_DIST = 40;
    const toilet = WORLD_OBJECTS.TOILET;
    
    if (!toilet) return false;
    
    const toiletCenterX = (toilet.x + OFFSET_X + toilet.w / 2) * TILE_SIZE;
    const toiletCenterY = (toilet.y + OFFSET_Y + toilet.h / 2) * TILE_SIZE;
    const dadCenterX = x + gameState.dad.width / 2;
    const dadCenterY = y + gameState.dad.height / 2;
    
    const dist = Math.hypot(toiletCenterX - dadCenterX, toiletCenterY - dadCenterY);
    
    if (dist < INTERACT_DIST) {
        // Check if ensuite door is closed for maximum hiding
        const ensuiteDoor = DOORS.find(d => d.name === 'Ensuite → Master Bedroom');
        return { canHide: true, doorClosed: ensuiteDoor && !ensuiteDoor.open };
    }
    
    return false;
}

function checkCoffeeMachine(x, y) {
    const INTERACT_DIST = 56;
    const coffee = WORLD_OBJECTS.COFFEE_MACHINE;
    
    if (!coffee) return false;
    
    const coffeeCenterX = (coffee.x + OFFSET_X + coffee.w / 2) * TILE_SIZE;
    const coffeeCenterY = (coffee.y + OFFSET_Y + coffee.h / 2) * TILE_SIZE;
    const dadCenterX = x + gameState.dad.width / 2;
    const dadCenterY = y + gameState.dad.height / 2;
    
    const dist = Math.hypot(coffeeCenterX - dadCenterX, coffeeCenterY - dadCenterY);
    return dist < INTERACT_DIST;
}

function drawPlaytestOverlay() {
    if (!playtestBot.active || (!playtestBot.objective && !playtestBot.recoveryTarget && !playtestBot.lastMoveTarget)) {
        return;
    }

    const dadCenterX = gameState.dad.x + gameState.dad.width / 2;
    const dadCenterY = gameState.dad.y + gameState.dad.height / 2;
    const points = [{ x: dadCenterX, y: dadCenterY }];

    if (playtestBot.route) {
        for (const waypointName of playtestBot.route.waypoints.slice(playtestBot.routeIndex, playtestBot.routeIndex + 6)) {
            const waypoint = WAYPOINTS[waypointName];
            if (waypoint) {
                points.push({ x: waypoint.pixelX, y: waypoint.pixelY });
            }
        }
    }

    if (playtestBot.objective) {
        points.push({ x: playtestBot.objective.targetX, y: playtestBot.objective.targetY });
    } else if (playtestBot.lastMoveTarget) {
        points.push({ x: playtestBot.lastMoveTarget.x, y: playtestBot.lastMoveTarget.y });
    }

    ctx.save();

    if (points.length > 1) {
        ctx.strokeStyle = 'rgba(77, 184, 255, 0.9)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (playtestBot.objective) {
        ctx.strokeStyle = 'rgba(255, 204, 0, 0.95)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(playtestBot.objective.targetX, playtestBot.objective.targetY, 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(playtestBot.objective.targetX - 12, playtestBot.objective.targetY);
        ctx.lineTo(playtestBot.objective.targetX + 12, playtestBot.objective.targetY);
        ctx.moveTo(playtestBot.objective.targetX, playtestBot.objective.targetY - 12);
        ctx.lineTo(playtestBot.objective.targetX, playtestBot.objective.targetY + 12);
        ctx.stroke();
    }

    if (playtestBot.lastMoveTarget) {
        ctx.fillStyle = 'rgba(77, 184, 255, 0.95)';
        ctx.beginPath();
        ctx.arc(playtestBot.lastMoveTarget.x, playtestBot.lastMoveTarget.y, 8, 0, Math.PI * 2);
        ctx.fill();

        const nextLabel = describePlaytestWaypoint(playtestBot.lastMoveTarget.waypointName);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(nextLabel, playtestBot.lastMoveTarget.x, playtestBot.lastMoveTarget.y - 12);
    }

    if (playtestBot.recoveryTarget) {
        ctx.strokeStyle = 'rgba(255, 138, 61, 0.95)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(playtestBot.recoveryTarget.x, playtestBot.recoveryTarget.y, 12, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
}

function render() {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Find nearby interactables once at the start
    const nearbyTask = findNearbyTask();
    const nearbyDoor = findNearbyDoor();

    // Camera transform
    ctx.save();
    ctx.translate(gameState.cameraOffsetX, gameState.cameraOffsetY);
    ctx.scale(gameState.cameraScale, gameState.cameraScale);

    // Draw rooms
    for (let room of Object.values(ROOMS)) {
        ctx.fillStyle = room.color;
        ctx.fillRect(room.x * TILE_SIZE, room.y * TILE_SIZE, room.w * TILE_SIZE, room.h * TILE_SIZE);

        // Room borders
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        ctx.strokeRect(room.x * TILE_SIZE, room.y * TILE_SIZE, room.w * TILE_SIZE, room.h * TILE_SIZE);

        // Room label
        ctx.fillStyle = '#666';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(room.name, room.x * TILE_SIZE + 5, room.y * TILE_SIZE + 15);
    }

    // Draw freshly mowed patches in the outdoor grass
    for (const key of gameState.mowedGrass) {
        const [patchX, patchY] = key.split(',').map(Number);
        ctx.fillStyle = 'rgba(190, 230, 120, 0.45)';
        ctx.fillRect(patchX, patchY, 28, 28);
        ctx.strokeStyle = 'rgba(110, 150, 70, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(patchX + 4, patchY + 6);
        ctx.lineTo(patchX + 24, patchY + 6);
        ctx.moveTo(patchX + 4, patchY + 14);
        ctx.lineTo(patchX + 24, patchY + 14);
        ctx.moveTo(patchX + 4, patchY + 22);
        ctx.lineTo(patchX + 24, patchY + 22);
        ctx.stroke();
    }

    // Draw walls (always visible, very obvious)
    ctx.fillStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#333333';
    for (let wall of WALLS) {
        const wallX = wall.x * TILE_SIZE;
        const wallY = wall.y * TILE_SIZE;
        const wallW = wall.w * TILE_SIZE;
        const wallH = wall.h * TILE_SIZE;

        ctx.fillRect(wallX, wallY, wallW, wallH);
        ctx.strokeRect(wallX, wallY, wallW, wallH);

        // Draw wall coordinates overlay (debug mode only)
        if (DEBUG_MODE) {
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const coordText = `x:${wall.x.toFixed(1)} y:${wall.y.toFixed(1)} w:${wall.w}`;

            // Draw black outline
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.strokeText(coordText, wallX + wallW / 2, wallY + wallH / 2);

            // Draw yellow text
            ctx.fillStyle = '#ffff00';
            ctx.fillText(coordText, wallX + wallW / 2, wallY + wallH / 2);
        }
    }

    // Draw doors AFTER walls but make them thicker and more visible
    for (let i = 0; i < DOORS.length; i++) {
        const door = DOORS[i];
        const doorX = door.x * TILE_SIZE;
        const doorY = door.y * TILE_SIZE;
        const doorW = door.w * TILE_SIZE;
        const doorH = door.h * TILE_SIZE;

        // Highlight if this is the nearby door
        const isNearby = nearbyDoor && nearbyDoor.index === i;

        // Use stored orientation
        const isHorizontal = door.orient === 'h';

        // Visual dimensions for rendering (thinner than hitbox)
        let drawX, drawY, drawW, drawH;
        if (isHorizontal) {
            drawW = doorW;
            drawH = 8;
            drawX = doorX;
            drawY = doorY + (doorH - 8) / 2;
        } else {
            drawW = 8;
            drawH = doorH;
            drawX = doorX + (doorW - 8) / 2;
            drawY = doorY;
        }

        if (door.open) {
            // Draw door swung open at 90 degrees (arc shape)
            ctx.save();

            // Draw the arc to show door is open
            ctx.strokeStyle = isNearby ? '#ffff66' : '#ffff00';
            ctx.lineWidth = 4;
            ctx.setLineDash([4, 4]);  // Dashed line to show swing path

            // Determine swing direction and position
            if (isHorizontal) {
                // Horizontal door - swings up or down
                const centerX = drawX + drawW / 2;
                const centerY = drawY;
                ctx.beginPath();
                ctx.arc(centerX, centerY, drawW / 2, 0, Math.PI, false);
                ctx.stroke();
            } else {
                // Vertical door - swings left or right
                const centerX = drawX;
                const centerY = drawY + drawH / 2;
                ctx.beginPath();
                ctx.arc(centerX, centerY, drawH / 2, -Math.PI / 2, Math.PI / 2, false);
                ctx.stroke();
            }

            ctx.setLineDash([]);  // Reset dash
            ctx.restore();
        } else {
            // Draw closed door as thick rectangle matching wall orientation
            ctx.fillStyle = isNearby ? '#ff9933' : '#cc8800';  // Orange when closed
            ctx.fillRect(drawX, drawY, drawW, drawH);

            // Thick border
            ctx.strokeStyle = isNearby ? '#fff' : '#000';
            ctx.lineWidth = isNearby ? 3 : 2;
            ctx.strokeRect(drawX, drawY, drawW, drawH);
        }
    }

    // Draw world objects (furniture, etc)
    drawWorldObjects();

    // Highlight incomplete task POIs
    for (let task of gameState.tasks) {
        let poi = null;
        for (let p of Object.values(POIS)) {
            if (p.name === task.location) {
                poi = p;
                break;
            }
        }

        if (poi) {
            const poiX = poi.x * TILE_SIZE + TILE_SIZE / 2;
            const poiY = poi.y * TILE_SIZE + TILE_SIZE / 2;

            // Draw task indicators
            if (task.progress < task.maxProgress) {
                ctx.fillStyle = 'rgba(255, 150, 100, 0.3)';
                ctx.beginPath();
                ctx.arc(poiX, poiY, 25, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Draw POIs with distinctive visuals and labels
    const poiColors = {
        'relax': '#ff69b4',      // Pink for relax areas
        'dishes': '#4dd0ff',     // Cyan for kitchen sink
        'fetch': '#ffaa00',      // Orange for fetch items
        'deposit': '#ff6b6b',    // Red for deposit/cleanup
        'coverage': '#ffff00',   // Yellow for coverage tasks
        'tool': '#90ee90',       // Light green for tools
        'hold': '#dda0dd'        // Plum for hold tasks
    };

    for (let poi of Object.values(POIS)) {
        const poiX = poi.x * TILE_SIZE + TILE_SIZE / 2;
        const poiY = poi.y * TILE_SIZE + TILE_SIZE / 2;
        const color = poiColors[poi.type] || '#ffaa00';

        // Check if this POI matches the nearby task
        const isNearby = nearbyTask && poi.name === nearbyTask.location;

        // Draw circle (larger if nearby)
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(poiX, poiY, isNearby ? 16 : 14, 0, Math.PI * 2);
        ctx.fill();

        // Draw border (white and thicker if nearby)
        ctx.strokeStyle = isNearby ? '#fff' : '#000';
        ctx.lineWidth = isNearby ? 3 : 2;
        ctx.beginPath();
        ctx.arc(poiX, poiY, isNearby ? 16 : 14, 0, Math.PI * 2);
        ctx.stroke();

        // Draw label below
        ctx.fillStyle = isNearby ? '#fff' : color;
        ctx.font = isNearby ? 'bold 9px monospace' : '8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(poi.name, poiX, poiY + 18);
    }

    // Draw world entities (poop, toys, mess)
    for (const ent of gameState.entities) {
        if (ent.type === 'poop') {
            ctx.fillStyle = '#6b4226';
            ctx.beginPath();
            ctx.arc(ent.x, ent.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#4a2e1a';
            ctx.beginPath();
            ctx.arc(ent.x + 2, ent.y - 3, 3, 0, Math.PI * 2);
            ctx.fill();
        } else if (ent.type === 'toy') {
            ctx.fillStyle = '#ff6699';
            ctx.fillRect(ent.x - 4, ent.y - 4, 8, 8);
        } else if (ent.type === 'mess') {
            ctx.fillStyle = 'rgba(120, 120, 120, 0.6)';
            ctx.beginPath();
            ctx.arc(ent.x, ent.y, 7, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    if (gameState.mower && gameState.dad.carrying !== 'MOWER') {
        const mower = gameState.mower;
        ctx.fillStyle = '#d43a32';
        ctx.fillRect(mower.x, mower.y, mower.width, mower.height);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.strokeRect(mower.x, mower.y, mower.width, mower.height);

        ctx.strokeStyle = '#cfcfcf';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(mower.x + mower.width - 4, mower.y + 4);
        ctx.lineTo(mower.x + mower.width + 14, mower.y - 10);
        ctx.stroke();

        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(mower.x + 8, mower.y + mower.height, 4, 0, Math.PI * 2);
        ctx.arc(mower.x + mower.width - 8, mower.y + mower.height, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw regular chickens
    for (const chicken of gameState.chickens) {
        const spriteKey = chicken.name ? chicken.name.toLowerCase() : 'aylin';

        if (spriteCache[spriteKey]) {
            const spriteWidth = 30;
            const spriteHeight = 30;
            const radius = spriteWidth / 2;

            // Create circular clipping path
            ctx.save();
            ctx.beginPath();
            ctx.arc(chicken.x, chicken.y, radius, 0, Math.PI * 2);
            ctx.clip();

            // Draw sprite inside clipped circle
            ctx.drawImage(spriteCache[spriteKey], chicken.x - radius, chicken.y - radius, spriteWidth, spriteHeight);
            ctx.restore();
        } else {
            // Fallback: draw circle
            ctx.fillStyle = '#f5f5f0';
            ctx.beginPath();
            ctx.arc(chicken.x, chicken.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#aaa';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = '#333';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('c', chicken.x, chicken.y);
        }
    }

    // Draw aggressive chickens
    for (const chicken of gameState.aggressiveChickens) {
        const spriteKey = chicken.name ? chicken.name.toLowerCase() : 'morag';

        if (spriteCache[spriteKey]) {
            const spriteWidth = 30;
            const spriteHeight = 30;
            const radius = spriteWidth / 2;

            // Create circular clipping path
            ctx.save();
            ctx.beginPath();
            ctx.arc(chicken.x, chicken.y, radius, 0, Math.PI * 2);
            ctx.clip();

            // Draw sprite inside clipped circle
            ctx.drawImage(spriteCache[spriteKey], chicken.x - radius, chicken.y - radius, spriteWidth, spriteHeight);
            ctx.restore();
        } else {
            // Fallback: draw circle
            ctx.fillStyle = '#cc4422';
            ctx.beginPath();
            ctx.arc(chicken.x, chicken.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#881111';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('C', chicken.x, chicken.y);
        }
    }

    // Draw NPCs with distinguishable characters
    const npcList = [
        { state: gameState.npcStates.wife, char: 'W', name: 'Wife', color: '#ff6b9d' },
        { state: gameState.npcStates.housemate, char: 'J', name: 'Jake', color: '#ff9999' },
        { state: gameState.npcStates.baby, char: 'B', name: 'Baby', color: '#ffcc99' },
        { state: gameState.npcStates.brownDog, char: 'M', name: 'Momo', color: '#cc9966' },
        { state: gameState.npcStates.blackDog, char: 'P', name: 'Piper', color: '#666666' }
    ];

    if (gameState.npcStates.munty) {
        npcList.push({ state: gameState.npcStates.munty, char: 'm', name: 'Munty', color: '#000000', pulse: true });
    }

    for (let npc of npcList) {
        const x = npc.state.x;
        const y = npc.state.y;

        // Munty vibrates and pulses red
        let offsetX = 0, offsetY = 0;
        let alpha = 1.0;
        if (npc.pulse && npc.state.vibrate !== undefined) {
            offsetX = Math.sin(npc.state.vibrate) * 2;
            offsetY = Math.cos(npc.state.vibrate * 1.3) * 2;
        }

        // Determine sprite key from NPC type
        let spriteKey = null;
        if (npc.char === 'W') spriteKey = 'wife';
        else if (npc.char === 'J') spriteKey = 'housemate';
        else if (npc.char === 'B') spriteKey = 'baby';
        else if (npc.char === 'M') spriteKey = 'brownDog';
        else if (npc.char === 'P') spriteKey = 'blackDog';
        else if (npc.char === 'm') spriteKey = 'munty';

        // Draw sprite or fallback to circle
        if (spriteKey && spriteCache[spriteKey]) {
            const spriteWidth = 40;
            const spriteHeight = 40;
            const radius = spriteWidth / 2;

            ctx.save();
            if (npc.pulse && npc.state.vibrate !== undefined) {
                ctx.globalAlpha = 0.85 + 0.15 * (Math.sin(npc.state.vibrate * 2) * 0.5 + 0.5);
            }

            // Create circular clipping path for sprite
            ctx.beginPath();
            ctx.arc(x + offsetX, y + offsetY, radius, 0, Math.PI * 2);
            ctx.clip();

            // Draw sprite inside clipped circle
            ctx.drawImage(spriteCache[spriteKey], x + offsetX - radius, y + offsetY - radius, spriteWidth, spriteHeight);
            ctx.restore();
        } else {
            // Fallback: draw colored circle if sprite not loaded
            ctx.fillStyle = npc.color;
            ctx.beginPath();
            ctx.arc(x + offsetX, y + offsetY, 12, 0, Math.PI * 2);
            ctx.fill();

            // Draw border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x + offsetX, y + offsetY, 12, 0, Math.PI * 2);
            ctx.stroke();

            // Draw character
            ctx.fillStyle = '#000';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(npc.char, x + offsetX, y + offsetY);
        }

        // Draw name below sprite
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(npc.name, x, y + 25);
    }

    // Draw dad (larger and centered)

    // ========================================
    // FEATURE PATCH: VISUAL INDICATORS
    // ========================================
    
    // Draw relaxing indicator
    if (gameState.isRelaxing && gameState.relaxSpot) {
        const obj = WORLD_OBJECTS[gameState.relaxSpot];
        if (obj) {
            const objX = (obj.x + OFFSET_X + obj.w / 2) * TILE_SIZE;
            const objY = (obj.y + OFFSET_Y + obj.h / 2) * TILE_SIZE;
            
            ctx.strokeStyle = 'rgba(100, 255, 100, 0.5)';
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(objX, objY, 40, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
    
    // Draw coffee brewing progress
    if (gameState.coffeeProgress > 0) {
        const coffee = WORLD_OBJECTS.COFFEE_MACHINE;
        if (coffee) {
            const coffeeX = (coffee.x + OFFSET_X) * TILE_SIZE;
            const coffeeY = (coffee.y + OFFSET_Y) * TILE_SIZE - 20;
            const progress = gameState.coffeeProgress / gameState.coffeeBrewTime;
            
            ctx.fillStyle = 'rgba(139, 69, 19, 0.8)';
            ctx.fillRect(coffeeX, coffeeY, coffee.w * TILE_SIZE * progress, 5);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(coffeeX, coffeeY, coffee.w * TILE_SIZE, 5);
        }
    }
    
    const dadPixelX = gameState.dad.x + gameState.dad.width / 2;
    const dadPixelY = gameState.dad.y + gameState.dad.height / 2;

    // Draw Dad sprite or fallback to yellow square
    const spriteWidth = 50;
    const spriteHeight = 50;
    const dadRadius = spriteWidth / 2;

    if (spriteCache.dad) {
        // Create circular clipping path for Dad sprite
        ctx.save();
        ctx.beginPath();
        ctx.arc(dadPixelX, dadPixelY, dadRadius, 0, Math.PI * 2);
        ctx.clip();

        // Draw sprite inside clipped circle
        ctx.drawImage(spriteCache.dad, dadPixelX - dadRadius, dadPixelY - dadRadius, spriteWidth, spriteHeight);
        ctx.restore();
    } else {
        // Fallback: draw yellow square
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(dadPixelX - 15, dadPixelY - 15, 30, 30);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(dadPixelX - 15, dadPixelY - 15, 30, 30);

        ctx.fillStyle = '#000';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('D', dadPixelX, dadPixelY);
    }

    // Draw carrying indicator
    if (gameState.dad.carrying) {
        const carryingColors = {
            'BABY': '#ffb3ba',
            'BEER': '#8b4513',
            'COFFEE': '#6f4e37',
            'MOWER': '#d43a32'
        };
        const carryingLabels = {
            'BABY': '👶',
            'BEER': '🍺',
            'COFFEE': '☕',
            'MOWER': 'M'
        };

        const color = carryingColors[gameState.dad.carrying] || '#ff9999';
        const label = carryingLabels[gameState.dad.carrying] || '📦';

        // Draw carrying aura
        ctx.fillStyle = `${color}66`;
        ctx.beginPath();
        ctx.arc(dadPixelX, dadPixelY, 35, 0, Math.PI * 2);
        ctx.fill();

        // Draw carrying label above player
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.font = 'bold 16px monospace';
        ctx.strokeText(label, dadPixelX, dadPixelY - 35);
        ctx.fillText(label, dadPixelX, dadPixelY - 35);
    }

    // Draw Dad's name below
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Dad', dadPixelX, dadPixelY + 18);

    // Draw interaction radius and task hint
    if (nearbyTask || nearbyDoor) {
        ctx.strokeStyle = 'rgba(255, 200, 0, 0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(dadPixelX, dadPixelY, 120, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Show hint
        if (nearbyDoor) {
            ctx.fillStyle = 'rgba(100, 200, 100, 0.8)';
            ctx.fillRect(dadPixelX - 80, dadPixelY - 40, 160, 20);
            ctx.fillStyle = '#000';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('DOOR: ' + nearbyDoor.name + ' (Press E)', dadPixelX, dadPixelY - 28);
        } else if (nearbyTask) {
            ctx.fillStyle = 'rgba(255, 200, 0, 0.8)';
            ctx.fillRect(dadPixelX - 60, dadPixelY - 40, 120, 20);
            ctx.fillStyle = '#000';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('NEARBY: ' + nearbyTask.name, dadPixelX, dadPixelY - 28);
        }
    }

    // Draw audio rings (visual feedback for sounds)
    gameState.audioRings.forEach((ring, index) => {
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${ring.alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ring.r += 5;
        ring.alpha -= 0.02;
        if (ring.alpha <= 0) gameState.audioRings.splice(index, 1);
    });

    drawPlaytestOverlay();

    // Restore camera transform (back to screen space for UI)
    ctx.restore();

    // Draw HUD (screen space - stays locked to viewport)
    drawHUD();

    // Draw toilet vignette effect (screen space)
    drawToiletVignette();

    // Draw AOE circles for interactive elements
    drawAOECircles();

    // Draw dialogue shouts
    drawDialogues();

if (DEBUG_MODE) {
    // === NEW GAMEPLAY-FOCUSED DEBUG MENU ===
    // Simplified debug UI with gameplay tools
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(10, 10, 300, 500);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 300, 500);

    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('DEBUG MENU', 20, 30);

    ctx.font = '11px monospace';
    let y = 50;
    const debugOptions = [
        { key: '1', label: 'Spawn Poop (E)' },
        { key: '2', label: 'Spawn Toy (T)' },
        { key: '3', label: 'Spawn Munty (M)' },
        { key: '4', label: 'Spawn Chickens (C)' },
        { key: '5', label: '+Stress (Page Up)' },
        { key: '6', label: '-Stress (Page Down)' },
        { key: '7', label: 'Clear All Tasks (DEL)' },
        { key: '8', label: 'Toggle Baby Sleep (B)' },
        { key: '9', label: 'Wife Bark (W)' },
        { key: '0', label: 'Baby Wakeup (A)' },
        { key: 'P', label: 'Trigger Dialogue' },
        { key: 'X', label: 'Next Day (X)' }
    ];

    debugOptions.forEach((opt, i) => {
        ctx.fillStyle = '#00ff00';
        ctx.fillText(`[${opt.key}] ${opt.label}`, 20, y);
        y += 25;
    });

    ctx.font = '10px monospace';
    ctx.fillStyle = '#ffff00';
    ctx.fillText(`Day: ${gameState.day}`, 20, y);
    y += 20;
    ctx.fillText(`Stim: ${Math.floor(gameState.overstimulation)}%`, 20, y);
    y += 20;
    ctx.fillText(`Tasks: ${gameState.tasks.length}`, 20, y);
    y += 20;
    ctx.fillText(`Poops: ${gameState.entities.filter(e => e.type === 'poop').length}`, 20, y);
    y += 20;
    ctx.fillText(`Toys: ${gameState.entities.filter(e => e.type === 'toy').length}`, 20, y);

    ctx.restore();
}

// === DISABLED: Old waypoint visualization code
/*
if (DEBUG_MODE) {
    // === WAYPOINTS (yellow) ===
    ctx.fillStyle = 'yellow';
    ctx.strokeStyle = 'orange';
    ctx.lineWidth = 2;

    for (const wpName in WAYPOINTS) {
        const wp = WAYPOINTS[wpName];
        ctx.beginPath();
        ctx.arc(wp.pixelX, wp.pixelY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Waypoint name
        ctx.fillStyle = 'white';
        ctx.font = '10px monospace';
        ctx.fillText(wpName, wp.pixelX + 10, wp.pixelY - 10);
        ctx.fillStyle = 'yellow';

        // Connections
        if (wp.connections) {
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.lineWidth = 1;
            for (const connName of wp.connections) {
                const connWP = WAYPOINTS[connName];
                if (connWP) {
                    ctx.beginPath();
                    ctx.moveTo(wp.pixelX, wp.pixelY);
                    ctx.lineTo(connWP.pixelX, connWP.pixelY);
                    ctx.stroke();
                }
            }
        }
    }
    
    // === NPC PATHS (cyan) ===
    ctx.strokeStyle = 'cyan';
    ctx.lineWidth = 3;
    
    for (const npcKey in gameState.npcStates) {
        const npc = gameState.npcStates[npcKey];
        if (!npc || !npc.waypointPath || npc.waypointPath.length === 0) continue;
        
        // Line from NPC to first waypoint
        const firstWP = WAYPOINTS[npc.waypointPath[0]];
        if (firstWP) {
            ctx.beginPath();
            ctx.moveTo(npc.x, npc.y);
            ctx.lineTo(firstWP.pixelX, firstWP.pixelY);
            ctx.stroke();
        }
        
        // Lines between waypoints in path
        for (let i = 0; i < npc.waypointPath.length - 1; i++) {
            const wp1 = WAYPOINTS[npc.waypointPath[i]];
            const wp2 = WAYPOINTS[npc.waypointPath[i + 1]];
            if (wp1 && wp2) {
                ctx.beginPath();
                ctx.moveTo(wp1.pixelX, wp1.pixelY);
                ctx.lineTo(wp2.pixelX, wp2.pixelY);
                ctx.stroke();
            }
        }
        
        // Current waypoint target (red circle)
        if (npc.currentWaypointIndex !== undefined && npc.waypointPath[npc.currentWaypointIndex]) {
            const currentWP = WAYPOINTS[npc.waypointPath[npc.currentWaypointIndex]];
            if (currentWP) {
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(currentWP.pixelX, currentWP.pixelY, 12, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }
    
    // === NPC TARGET DESTINATIONS (green cross) ===
    for (const npcKey in gameState.npcStates) {
        const npc = gameState.npcStates[npcKey];
        if (!npc) continue;
        
        // Show final target destination
        if (npc.waypointTarget) {
            ctx.strokeStyle = 'lime';
            ctx.lineWidth = 3;
            // Draw X mark
            ctx.beginPath();
            ctx.moveTo(npc.waypointTarget.x - 10, npc.waypointTarget.y - 10);
            ctx.lineTo(npc.waypointTarget.x + 10, npc.waypointTarget.y + 10);
            ctx.moveTo(npc.waypointTarget.x + 10, npc.waypointTarget.y - 10);
            ctx.lineTo(npc.waypointTarget.x - 10, npc.waypointTarget.y + 10);
            ctx.stroke();
        }
    }
    
    // === DOOR STATES ===
    for (let i = 0; i < DOORS.length; i++) {
        const door = DOORS[i];
        
        // Draw door outline
        ctx.strokeStyle = door.open ? 'lime' : 'red';
        ctx.lineWidth = 3;
        ctx.strokeRect(door.x, door.y, door.width, door.height);
        
        // Draw door state text
        ctx.fillStyle = door.open ? 'lime' : 'red';
        ctx.font = '12px monospace';
        const doorLabel = door.open ? 'OPEN' : 'CLOSED';
        ctx.fillText(doorLabel, door.x + door.width / 2 - 20, door.y - 5);
    }
    
    // === NPC COLLISION BOXES (magenta) ===
    ctx.strokeStyle = 'magenta';
    ctx.lineWidth = 1;
    for (const npcKey in gameState.npcStates) {
        const npc = gameState.npcStates[npcKey];
        if (!npc) continue;
        
        ctx.strokeRect(npc.x - 10, npc.y - 10, 20, 20);
    }
    
    // === LINE OF SIGHT CHECKS (white dotted) ===
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    for (const npcKey in gameState.npcStates) {
        const npc = gameState.npcStates[npcKey];
        if (!npc || !npc.waypointTarget) continue;
        
        // Check if NPC has line of sight to target
        if (hasLineOfSight(npc.x, npc.y, npc.waypointTarget.x, npc.waypointTarget.y, 14)) {
            ctx.strokeStyle = 'lime';
        } else {
            ctx.strokeStyle = 'red';
        }
        
        ctx.beginPath();
        ctx.moveTo(npc.x, npc.y);
        ctx.lineTo(npc.waypointTarget.x, npc.waypointTarget.y);
        ctx.stroke();
    }
    ctx.setLineDash([]); // Reset to solid lines
    
    // === NPC INFO OVERLAY ===
    ctx.fillStyle = 'white';
    ctx.font = '10px monospace';
    let infoY = 120; // Start below game timer
    
    for (const npcKey in gameState.npcStates) {
        const npc = gameState.npcStates[npcKey];
        if (!npc) continue;
        
        const pathInfo = npc.waypointPath ? `path[${npc.waypointPath.length}]@${npc.currentWaypointIndex || 0}` : 'no path';
        const targetInfo = npc.targetRoom || 'no target';
        
        ctx.fillText(`${npcKey}: ${targetInfo} ${pathInfo}`, 10, infoY);
        infoY += 12;
    }
    
    // === POIS (Points of Interest - REMOVED TO DECLUTTER MAP) ===
    // POI definitions kept in code for task system and NPC navigation
    // Comment out the rendering to focus on NPC AI behavior
    
    // === DOOR INTERACTIONS (purple) ===
    for (const npcKey in gameState.npcStates) {
        const npc = gameState.npcStates[npcKey];
        if (!npc || !npc.doorInteraction) continue;
        
        const door = DOORS[npc.doorInteraction.doorIndex];
        if (door) {
            ctx.strokeStyle = 'purple';
            ctx.lineWidth = 4;
            ctx.strokeRect(door.x - 5, door.y - 5, door.width + 10, door.height + 10);
            
            // Line from NPC to door
            ctx.beginPath();
            ctx.moveTo(npc.x, npc.y);
            ctx.lineTo(door.x + door.width / 2, door.y + door.height / 2);
            ctx.stroke();
        }
    }

    // Draw waypoints as yellow circles
    ctx.fillStyle = 'yellow';
    ctx.strokeStyle = 'orange';
    ctx.lineWidth = 2;
    
    for (const wpName in WAYPOINTS) {
        const wp = WAYPOINTS[wpName];
        ctx.beginPath();
        ctx.arc(wp.pixelX, wp.pixelY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw waypoint name
        ctx.fillStyle = 'white';
        ctx.font = '10px monospace';
        ctx.fillText(wpName, wp.pixelX + 10, wp.pixelY - 10);
        ctx.fillStyle = 'yellow';
        
        // Draw connections between waypoints
        if (wp.connections) {
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.lineWidth = 1;
            for (const connName of wp.connections) {
                const connWP = WAYPOINTS[connName];
                if (connWP) {
                    ctx.beginPath();
                    ctx.moveTo(wp.pixelX, wp.pixelY);
                    ctx.lineTo(connWP.pixelX, connWP.pixelY);
                    ctx.stroke();
                }
            }
        }
    }
    
    // Draw current paths for each NPC
    ctx.strokeStyle = 'cyan';
    ctx.lineWidth = 3;
    
    for (const npcKey in gameState.npcStates) {
        const npc = gameState.npcStates[npcKey];
        if (!npc || !npc.waypointPath || npc.waypointPath.length === 0) continue;
        
        // Draw line from NPC to first waypoint
        const firstWP = WAYPOINTS[npc.waypointPath[0]];
        if (firstWP) {
            ctx.beginPath();
            ctx.moveTo(npc.x, npc.y);
            ctx.lineTo(firstWP.pixelX, firstWP.pixelY);
            ctx.stroke();
        }
        
        // Draw lines between waypoints in path
        for (let i = 0; i < npc.waypointPath.length - 1; i++) {
            const wp1 = WAYPOINTS[npc.waypointPath[i]];
            const wp2 = WAYPOINTS[npc.waypointPath[i + 1]];
            if (wp1 && wp2) {
                ctx.beginPath();
                ctx.moveTo(wp1.pixelX, wp1.pixelY);
                ctx.lineTo(wp2.pixelX, wp2.pixelY);
                ctx.stroke();
            }
        }
        
        // Draw current waypoint target with a red circle
        if (npc.currentWaypointIndex !== undefined && npc.waypointPath[npc.currentWaypointIndex]) {
            const currentWP = WAYPOINTS[npc.waypointPath[npc.currentWaypointIndex]];
            if (currentWP) {
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(currentWP.pixelX, currentWP.pixelY, 12, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }
    END OF DISABLED MAIN OVERLAY DEBUG */
}

// === MINIMAP DEBUG (only in DEBUG_MODE) ===
if (DEBUG_MODE) {
    ctx.restore(); // Exit camera transform first

    // Minimap settings
    const minimapWidth = 400;
    const minimapHeight = 300;
    const minimapX = GAME_WIDTH - minimapWidth - 20;
    const minimapY = 20;
    const scale = Math.min(minimapWidth / (GAME_WIDTH), minimapHeight / (GAME_HEIGHT));

    // Black background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(minimapX, minimapY, minimapWidth, minimapHeight);
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(minimapX, minimapY, minimapWidth, minimapHeight);

    ctx.save();
    ctx.translate(minimapX, minimapY);
    ctx.scale(scale, scale);

    // Draw rooms (subtle outlines only)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    for (let room of Object.values(ROOMS)) {
        ctx.strokeRect(room.x * TILE_SIZE, room.y * TILE_SIZE, room.w * TILE_SIZE, room.h * TILE_SIZE);
    }

    // Draw walls (thin gray)
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    for (let wall of WALLS) {
        ctx.strokeRect(wall.x * TILE_SIZE, wall.y * TILE_SIZE, wall.w * TILE_SIZE, wall.h * TILE_SIZE);
    }

    // Draw doors (small dots)
    for (let door of DOORS) {
        ctx.fillStyle = door.open ? '#0a0' : '#a00';
        ctx.beginPath();
        ctx.arc(door.x * TILE_SIZE + (door.w * TILE_SIZE) / 2,
                door.y * TILE_SIZE + (door.h * TILE_SIZE) / 2,
                2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw waypoints
    ctx.fillStyle = 'yellow';
    for (const wpName in WAYPOINTS) {
        const wp = WAYPOINTS[wpName];
        ctx.beginPath();
        ctx.arc(wp.pixelX, wp.pixelY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Connections
        if (wp.connections) {
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
            ctx.lineWidth = 1;
            for (const connName of wp.connections) {
                const connWP = WAYPOINTS[connName];
                if (connWP) {
                    ctx.beginPath();
                    ctx.moveTo(wp.pixelX, wp.pixelY);
                    ctx.lineTo(connWP.pixelX, connWP.pixelY);
                    ctx.stroke();
                }
            }
        }
    }

    // Draw NPCs and their paths
    for (const npcKey in gameState.npcStates) {
        const npc = gameState.npcStates[npcKey];
        if (!npc) continue;

        // NPC position
        ctx.fillStyle = 'cyan';
        ctx.beginPath();
        ctx.arc(npc.x, npc.y, 6, 0, Math.PI * 2);
        ctx.fill();

        // Current path
        if (npc.waypointPath && npc.waypointPath.length > 0) {
            ctx.strokeStyle = 'cyan';
            ctx.lineWidth = 2;

            // Line from NPC to first waypoint
            const firstWP = WAYPOINTS[npc.waypointPath[0]];
            if (firstWP) {
                ctx.beginPath();
                ctx.moveTo(npc.x, npc.y);
                ctx.lineTo(firstWP.pixelX, firstWP.pixelY);
                ctx.stroke();
            }

            // Lines between waypoints
            for (let i = 0; i < npc.waypointPath.length - 1; i++) {
                const wp1 = WAYPOINTS[npc.waypointPath[i]];
                const wp2 = WAYPOINTS[npc.waypointPath[i + 1]];
                if (wp1 && wp2) {
                    ctx.beginPath();
                    ctx.moveTo(wp1.pixelX, wp1.pixelY);
                    ctx.lineTo(wp2.pixelX, wp2.pixelY);
                    ctx.stroke();
                }
            }

            // Current target waypoint (red)
            if (npc.currentWaypointIndex !== undefined && npc.waypointPath[npc.currentWaypointIndex]) {
                const currentWP = WAYPOINTS[npc.waypointPath[npc.currentWaypointIndex]];
                if (currentWP) {
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(currentWP.pixelX, currentWP.pixelY, 8, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        }

        // Final destination (green X)
        if (npc.waypointTarget) {
            ctx.strokeStyle = 'lime';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(npc.waypointTarget.x - 8, npc.waypointTarget.y - 8);
            ctx.lineTo(npc.waypointTarget.x + 8, npc.waypointTarget.y + 8);
            ctx.moveTo(npc.waypointTarget.x + 8, npc.waypointTarget.y - 8);
            ctx.lineTo(npc.waypointTarget.x - 8, npc.waypointTarget.y + 8);
            ctx.stroke();
        }
    }

    // Draw player (white)
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(gameState.dad.x, gameState.dad.y, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

}

// ===== DIALOGUE SYSTEM =====
// Store active dialogue shouts
let activeDialogues = [];

// Track cooldowns to prevent spam
let dialogueCooldowns = {
    dad: 0,
    wife: 0,
    baby: 0,
    jake: 0,
    piper: 0,
    momo: 0,
    aylin: 0,
    munty: 0
};

// Dialogue pools for each character
const dialogueLines = {
    dad: {
        taskComplete: [
            "Classic!",
            "Done and dusted.",
            "Nailed it.",
            "One down!",
            "Finally.",
            "Sorted.",
            "*wipes brow* Phew."
        ],
        fart: ["*farts loudly*", "*BRAAAP*", "*silent but deadly*"],
        fartFollowup: ["Rich.", "That's gonna linger.", "Whoops.", "...Better out than in."],
        surrounded: [
            "Eugh, dogs, kids - this is so overstimulating!",
            "Can I get some SPACE please?!",
            "Everyone needs something!",
            "Personal space, anyone?",
            "I'm drowning here!"
        ],
        beer: ["*burps*", "Hrm... a bit wheatier than last time.", "This one is supposed to be a pale ale...", "*long sip* Ahhh.", "Not bad, not bad."],
        coffee: [
            "Coffee's ready. Thank god.",
            "Caffeine incoming.",
            "This'll help.",
            "*sips* Mmm."
        ],
        overwhelmed: [
            "Too much!",
            "I can't keep up!",
            "Everything's happening at once!",
            "ARGH!",
            "Just... give me a second!",
            "Why is there so much poop?!",
            "Can everyone just STOP for a minute?!"
        ],
        poop: [
            "Seriously? AGAIN?",
            "Who keeps pooping everywhere?!",
            "This is disgusting.",
            "I just cleaned this!",
            "*gags* Oh god."
        ],
        toys: [
            "Toys. Everywhere. Always.",
            "Could we maybe put ONE toy away?",
            "I'm gonna trip on these."
        ]
    },
    wife: {
        relaxing: [
            "This book is good! Not really my kind of fetishes though...",
            "That's a funny meme",
            "*scrolling* Heh.",
            "Oh, this is interesting...",
            "Finally, some peace.",
            "Mmm, this tea is perfect.",
            "I needed this break."
        ],
        kitchenDogs: ["Momo, Piper - out!", "Dogs! Kitchen is off-limits!", "Get OUT, you two!"],
        kitchenDogsFollowup: ["... They never listen...", "Every. Single. Time.", "Why do I even bother?"],
        kitchen: [
            "... Nearly out of yogurt again...",
            "Need to do a grocery run.",
            "Who ate all the cheese?",
            "Where did I put the oregano?",
            "*humming while cooking*"
        ],
        stress: [
            "Okay, this is getting chaotic.",
            "I need backup here!",
            "Babe? Little help?",
            "Can someone PLEASE help me?!"
        ],
        baby: [
            "Shh, shh, it's okay baby.",
            "There we go, settle down.",
            "You're alright, sweetie.",
            "Mama's here."
        ]
    },
    baby: {
        default: [
            "Momo! Momo Momo!",
            "Blelelele",
            "Gah!",
            "Babababa!",
            "DADA!",
            "Maaa!",
            "*giggles*",
            "*baby scream*",
            "Wahhh!",
            "No no no!",
            "*coos*"
        ]
    },
    jake: {
        coffeeRequest: ["YES PLEASE!", "Oh god yes, coffee!", "Make me one too!", "I NEED that."],
        flipOff: [
            "*flips off dad while nobody is looking*",
            "*middle finger when dad's back is turned*",
            "*makes rude gesture*"
        ],
        babbling: [
            "[He is babbling some shit about his birds again - nobody is listening, obviously.]",
            "[Going on about chicken diets. Nobody cares.]",
            "[Explaining bird behavior. Everyone is tuning out.]",
            "[Talking about his latest bird conspiracy theory.]",
            "[Something something chicken genetics...]"
        ],
        hat: ["Hat? Is this a hat?", "What is this thing?", "Baby, what's this?", "*holds up random object*"],
        kitchen: [
            "*raids fridge*",
            "Where's the good snacks?",
            "Anyone gonna eat this?",
            "Snack time."
        ],
        annoyed: [
            "Ugh, can I get some quiet?",
            "Too loud in here.",
            "I'm trying to chill.",
            "*eye roll*"
        ]
    },
    piper: {
        creeping: [
            "[Creeping, creeping... They can't see me.]",
            "[I'm invisible. I'm a shadow.]",
            "[Sneaky girl...]",
            "[Nobody suspects a thing.]"
        ],
        foodBowl: [
            "[FOOD?!]",
            "[FOOD! FOOD! FOOD!]",
            "[IS IT FOOD TIME?!]",
            "[HUNGRY! STARVING! DYING!]",
            "[BOWL IS EMPTY! EMERGENCY!]",
            "[THEY'RE TRYING TO STARVE ME!]"
        ],
        barkCar: ["[CAR! CAR! CAR!]", "[INTRUDER VEHICLE!]", "[SUSPICIOUS CAR DETECTED!]"],
        barkKangaroo: ["[KANGAROO! KANGAROO!]", "[BIG THING HOPPING!]", "[WHAT IS THAT?!]"],
        happy: [
            "[Yay, humans!]",
            "[I love everyone!]",
            "[Best day ever!]",
            "[So happy!]"
        ],
        zoomies: [
            "[ZOOMIES! MUST RUN!]",
            "[FAST! FASTER! FASTEST!]",
            "[NYOOM!]",
            "[CAN'T STOP WON'T STOP!]"
        ],
        jealous: [
            "[Why is Momo getting pets?!]",
            "[PAY ATTENTION TO ME!]",
            "[I'm the good dog!]"
        ]
    },
    momo: {
        searching: [
            "[Humans? Where humans?]",
            "[Must find dad.]",
            "[Where did everyone go?]",
            "[Looking for pets...]"
        ],
        licking: [
            "[Lick... lick... lick...]",
            "[Must not lick... Maybe just once.]",
            "[Lick humans. I'm a good boy.]",
            "[Everything needs licking.]",
            "[Face licks = love.]",
            "[Just... one... more... lick...]"
        ],
        foodBowl: [
            "[FOOD?!]",
            "[FOOD! FOOD! FOOD!]",
            "[IS IT FOOD TIME?!]",
            "[BOWL EMPTY = TRAGEDY!]",
            "[I'M WASTING AWAY!]",
            "[NEED SUSTENANCE!]"
        ],
        barkCar: ["[CAR! CAR! CAR!]", "[ALERT! VEHICLE!]", "[BARK AT METAL BEAST!]"],
        barkConfused: [
            "[WHAT IS PIPER BARKING AT?!]",
            "[I DON'T SEE IT BUT I'LL BARK TOO!]",
            "[BETTER BARK JUST IN CASE!]",
            "[SOLIDARITY BARKING!]"
        ],
        anxious: [
            "[Don't leave me!]",
            "[Where are you going?!]",
            "[Take me with you!]",
            "[I'll be good!]"
        ],
        tail: [
            "[Wag wag wag!]",
            "[Tail going crazy!]",
            "[Can't control tail!]"
        ]
    },
    munty: {
        // Munty is a dog - extremely annoying and stupid
        stupid: [
            "*bawk*",
            "*cluck cluck*",
            "[Food? No food.]",
            "[Peck dirt.]",
            "*confused chicken noises*",
            "[Run around aimlessly.]"
        ],
        annoying: [
            "*CONSTANT WHINING*",
            "*whine whine whine whine*",
            "[Need attention NOW!]",
            "*HIGH PITCHED BARK*",
            "YIPE! YIPE! YIPE!",
            "*scratching door non-stop*",
            "[LET ME IN! LET ME OUT! LET ME IN!]",
            "*howls for no reason*",
            "AROOOOO! AROOOOO!",
            "*barks at absolutely nothing*",
            "[BARK! BARK! BARK! BARK! BARK!]",
            "*whimpering intensely*",
            "[SOMEBODY PAY ATTENTION TO MEEEE!]",
            "*paws at everyone*",
            "[I FORGOT WHAT I WANTED BUT I WANT IT!]",
            "*runs in circles barking*",
            "[WHAT'S HAPPENING?! I DON'T KNOW BUT I'M UPSET!]",
            "*dramatic sighing*",
            "[Everyone is ignoring me. Life is pain.]",
            "*zooms past everyone at mach speed*",
            "AROOAROOAROOAROO!",
            "[IS IT TIME?! IS IT TIME FOR SOMETHING?!]",
            "*tippy taps intensely*",
            "*spins in circles for no reason*",
            "[EXCITEMENT! ABOUT WHAT?! WHO KNOWS!]"
        ]
    },
    aylin: {
        annoyed: [
            "[I swear, if I have to put Morticia back in her place again...]",
            "[These idiots. I'm surrounded by idiots.]",
            "[Why am I the only competent chicken?]",
            "[Ugh. Morticia is being dramatic again.]",
            "[I need better flock members.]"
        ],
        flee: ["[RUN! RUN!]", "[SCATTER!]", "[EVERYONE MOVE!]", "[DANGER! FLEE!]"],
        peck: [
            "*peck* *peck* [Peck.]",
            "[Establish dominance. Peck.]",
            "[You get a peck. Everyone gets a peck.]",
            "*aggressive pecking*"
        ],
        leadership: [
            "[Stay in formation, ladies.]",
            "[Follow me, I know where food is.]",
            "[Stop wandering off!]",
            "[I'm in charge here.]"
        ]
    }
};

// Add a dialogue shout to the active list with cooldown check
function addDialogue(character, text, duration = 5, x, y) {
    // Check cooldown
    if (dialogueCooldowns[character] > 0) return;

    let characterRef = null;

    // Map character names to their position references
    if (character === 'dad') {
        characterRef = { obj: gameState.dad };
    } else if (character === 'wife') {
        characterRef = { obj: gameState.npcStates.wife };
    } else if (character === 'baby') {
        characterRef = { obj: gameState.npcStates.baby };
    } else if (character === 'jake') {
        characterRef = { obj: gameState.npcStates.housemate };
    } else if (character === 'piper') {
        characterRef = { obj: gameState.npcStates.blackDog };
    } else if (character === 'momo') {
        characterRef = { obj: gameState.npcStates.brownDog };
    } else if (character === 'munty') {
        // Munty is the ghost dog NPC (joins Day 2)
        if (gameState.npcStates.munty) {
            characterRef = { obj: gameState.npcStates.munty };
        }
    } else if (character === 'aylin') {
        // Aylin is the leader chicken
        const aylin = gameState.chickens.find(c => c.isLeader);
        if (aylin) characterRef = { obj: aylin };
    }

    activeDialogues.push({
        character,
        text,
        duration,
        timeLeft: duration,
        characterRef,
        x, // Fallback x position
        y, // Fallback y position
        bobOffset: 0
    });

    // Set cooldown (longer cooldown = less spam)
    dialogueCooldowns[character] = duration + 3;
}

// Helper: Check if two entities are in the same room
function inSameRoom(pos1, pos2) {
    for (let roomKey in ROOMS) {
        const room = ROOMS[roomKey];
        const inRoom1 = pos1.x >= room.x * TILE_SIZE && pos1.x <= (room.x + room.w) * TILE_SIZE &&
                        pos1.y >= room.y * TILE_SIZE && pos1.y <= (room.y + room.h) * TILE_SIZE;
        const inRoom2 = pos2.x >= room.x * TILE_SIZE && pos2.x <= (room.x + room.w) * TILE_SIZE &&
                        pos2.y >= room.y * TILE_SIZE && pos2.y <= (room.y + room.h) * TILE_SIZE;
        if (inRoom1 && inRoom2) return roomKey;
    }
    return null;
}

// Helper: Get which room an entity is in
function getRoom(pos) {
    for (let roomKey in ROOMS) {
        const room = ROOMS[roomKey];
        if (pos.x >= room.x * TILE_SIZE && pos.x <= (room.x + room.w) * TILE_SIZE &&
            pos.y >= room.y * TILE_SIZE && pos.y <= (room.y + room.h) * TILE_SIZE) {
            return roomKey;
        }
    }
    return null;
}

// Helper: Check if entity is near position
function isNearPosition(entity, x, y, radius = 100) {
    const dx = entity.x - x;
    const dy = entity.y - y;
    return Math.sqrt(dx * dx + dy * dy) < radius;
}

// Generate context-sensitive dialogue
function generateContextDialogue() {
    const dadRoom = getRoom(gameState.dad);
    const stimLevel = gameState.overstimulation;
    const poopCount = gameState.entities.filter(e => e.type === 'poop').length;
    const toyCount = gameState.entities.filter(e => e.type === 'toy').length;

    // === DAD: Context-sensitive dialogue ===
    // Overwhelmed
    if (stimLevel > 75 && Math.random() < 0.01) {
        const line = dialogueLines.dad.overwhelmed[Math.floor(Math.random() * dialogueLines.dad.overwhelmed.length)];
        addDialogue('dad', line, 5);
    }

    // Poop commentary
    if (poopCount > 2 && Math.random() < 0.005) {
        const line = dialogueLines.dad.poop[Math.floor(Math.random() * dialogueLines.dad.poop.length)];
        addDialogue('dad', line, 5);
    }

    // Toy commentary
    if (toyCount > 3 && Math.random() < 0.004) {
        const line = dialogueLines.dad.toys[Math.floor(Math.random() * dialogueLines.dad.toys.length)];
        addDialogue('dad', line, 5);
    }

    // === BABY: Random babbling (frequent) ===
    if (gameState.npcStates.baby && Math.random() < 0.015) {
        const line = dialogueLines.baby.default[Math.floor(Math.random() * dialogueLines.baby.default.length)];
        addDialogue('baby', line, 4);
    }

    // === WIFE: Context-sensitive dialogue ===
    if (gameState.npcStates.wife) {
        const wifeRoom = getRoom(gameState.npcStates.wife);

        // Relaxing on couch/bed
        if ((wifeRoom === 'LIVING_ROOM' || wifeRoom === 'MASTER_BEDROOM') && Math.random() < 0.006) {
            const line = dialogueLines.wife.relaxing[Math.floor(Math.random() * dialogueLines.wife.relaxing.length)];
            addDialogue('wife', line, 6);
        }

        // In kitchen with dogs
        if (wifeRoom === 'KITCHEN') {
            const dogsInKitchen = (getRoom(gameState.npcStates.brownDog) === 'KITCHEN' ||
                                   getRoom(gameState.npcStates.blackDog) === 'KITCHEN');
            if (dogsInKitchen && Math.random() < 0.01) {
                const dogLine = dialogueLines.wife.kitchenDogs[Math.floor(Math.random() * dialogueLines.wife.kitchenDogs.length)];
                addDialogue('wife', dogLine, 5);
                setTimeout(() => {
                    const followup = dialogueLines.wife.kitchenDogsFollowup[Math.floor(Math.random() * dialogueLines.wife.kitchenDogsFollowup.length)];
                    addDialogue('wife', followup, 5);
                }, 2000);
            } else if (Math.random() < 0.007) {
                const line = dialogueLines.wife.kitchen[Math.floor(Math.random() * dialogueLines.wife.kitchen.length)];
                addDialogue('wife', line, 5);
            }
        }

        // Stressed/overwhelmed
        if (stimLevel > 60 && Math.random() < 0.006) {
            const line = dialogueLines.wife.stress[Math.floor(Math.random() * dialogueLines.wife.stress.length)];
            addDialogue('wife', line, 5);
        }

        // With baby
        if (gameState.npcStates.baby) {
            const babyRoom = getRoom(gameState.npcStates.baby);
            if (wifeRoom === babyRoom && Math.random() < 0.008) {
                const line = dialogueLines.wife.baby[Math.floor(Math.random() * dialogueLines.wife.baby.length)];
                addDialogue('wife', line, 5);
            }
        }
    }

    // === JAKE: Context-sensitive dialogue ===
    if (gameState.npcStates.housemate) {
        const jake = gameState.npcStates.housemate;
        const jakeRoom = getRoom(jake);

        // Same room as dad - flip off
        if (jakeRoom === dadRoom && Math.random() < 0.006) {
            const line = dialogueLines.jake.flipOff[Math.floor(Math.random() * dialogueLines.jake.flipOff.length)];
            addDialogue('jake', line, 5);
        }

        // Bird babbling (anywhere, frequent)
        if (Math.random() < 0.008) {
            const line = dialogueLines.jake.babbling[Math.floor(Math.random() * dialogueLines.jake.babbling.length)];
            addDialogue('jake', line, 7);
        }

        // Same room as baby - hat comment
        if (gameState.npcStates.baby) {
            const babyRoom = getRoom(gameState.npcStates.baby);
            if (jakeRoom === babyRoom && Math.random() < 0.007) {
                const line = dialogueLines.jake.hat[Math.floor(Math.random() * dialogueLines.jake.hat.length)];
                addDialogue('jake', line, 5);
            }
        }

        // Kitchen behavior
        if (jakeRoom === 'KITCHEN' && Math.random() < 0.007) {
            const line = dialogueLines.jake.kitchen[Math.floor(Math.random() * dialogueLines.jake.kitchen.length)];
            addDialogue('jake', line, 4);
        }

        // Annoyed
        if (Math.random() < 0.005) {
            const line = dialogueLines.jake.annoyed[Math.floor(Math.random() * dialogueLines.jake.annoyed.length)];
            addDialogue('jake', line, 5);
        }
    }

    // === PIPER: Context-sensitive dialogue ===
    if (gameState.npcStates.blackDog) {
        const piper = gameState.npcStates.blackDog;
        const piperRoom = getRoom(piper);

        // Creeping around
        if (Math.random() < 0.008) {
            const line = dialogueLines.piper.creeping[Math.floor(Math.random() * dialogueLines.piper.creeping.length)];
            addDialogue('piper', line, 5);
        }

        // Happy around humans
        if (Math.random() < 0.007) {
            const line = dialogueLines.piper.happy[Math.floor(Math.random() * dialogueLines.piper.happy.length)];
            addDialogue('piper', line, 4);
        }

        // Zoomies
        if (Math.random() < 0.004) {
            const line = dialogueLines.piper.zoomies[Math.floor(Math.random() * dialogueLines.piper.zoomies.length)];
            addDialogue('piper', line, 3);
        }

        // Jealous
        if (Math.random() < 0.005) {
            const line = dialogueLines.piper.jealous[Math.floor(Math.random() * dialogueLines.piper.jealous.length)];
            addDialogue('piper', line, 4);
        }

        // Near food bowls (DOG_PATIO) - spam allowed
        if (piperRoom === 'DOG_PATIO' && Math.random() < 0.02) {
            const line = dialogueLines.piper.foodBowl[Math.floor(Math.random() * dialogueLines.piper.foodBowl.length)];
            dialogueCooldowns.piper = 0; // Allow spam for food
            addDialogue('piper', line, 3);
        }
    }

    // === MOMO: Context-sensitive dialogue ===
    if (gameState.npcStates.brownDog) {
        const momo = gameState.npcStates.brownDog;
        const momoRoom = getRoom(momo);

        // Licking behavior (frequent)
        if (Math.random() < 0.012) {
            const line = dialogueLines.momo.licking[Math.floor(Math.random() * dialogueLines.momo.licking.length)];
            addDialogue('momo', line, 5);
        }

        // Searching for humans
        if (Math.random() < 0.007) {
            const line = dialogueLines.momo.searching[Math.floor(Math.random() * dialogueLines.momo.searching.length)];
            addDialogue('momo', line, 4);
        }

        // Anxious
        if (Math.random() < 0.006) {
            const line = dialogueLines.momo.anxious[Math.floor(Math.random() * dialogueLines.momo.anxious.length)];
            addDialogue('momo', line, 4);
        }

        // Tail wagging
        if (Math.random() < 0.008) {
            const line = dialogueLines.momo.tail[Math.floor(Math.random() * dialogueLines.momo.tail.length)];
            addDialogue('momo', line, 3);
        }

        // Near food bowls (DOG_PATIO) - spam allowed
        if (momoRoom === 'DOG_PATIO' && Math.random() < 0.02) {
            const line = dialogueLines.momo.foodBowl[Math.floor(Math.random() * dialogueLines.momo.foodBowl.length)];
            dialogueCooldowns.momo = 0; // Allow spam for food
            addDialogue('momo', line, 3);
        }
    }

    // === MUNTY: EXTREMELY ANNOYING (very frequent) ===
    if (gameState.npcStates.munty) {
        // Keep the chicken noises as a joke
        if (Math.random() < 0.005) {
            const line = dialogueLines.munty.stupid[Math.floor(Math.random() * dialogueLines.munty.stupid.length)];
            addDialogue('munty', line, 4);
        }

        // ACTUAL annoying dog behavior (VERY frequent)
        if (Math.random() < 0.025) {
            const line = dialogueLines.munty.annoying[Math.floor(Math.random() * dialogueLines.munty.annoying.length)];
            dialogueCooldowns.munty = 2; // Short cooldown so it's annoying
            addDialogue('munty', line, 4);
        }
    }

    // === AYLIN: Context-sensitive dialogue ===
    const aylin = gameState.chickens.find(c => c.isLeader);
    if (aylin) {
        // Annoyed (general)
        if (Math.random() < 0.007) {
            const line = dialogueLines.aylin.annoyed[Math.floor(Math.random() * dialogueLines.aylin.annoyed.length)];
            addDialogue('aylin', line, 6);
        }

        // Fleeing
        if (aylin.state === 'flee' && Math.random() < 0.025) {
            const line = dialogueLines.aylin.flee[Math.floor(Math.random() * dialogueLines.aylin.flee.length)];
            addDialogue('aylin', line, 3);
        }

        // Pecking
        if (Math.random() < 0.008) {
            const line = dialogueLines.aylin.peck[Math.floor(Math.random() * dialogueLines.aylin.peck.length)];
            addDialogue('aylin', line, 4);
        }

        // Leadership
        if (Math.random() < 0.006) {
            const line = dialogueLines.aylin.leadership[Math.floor(Math.random() * dialogueLines.aylin.leadership.length)];
            addDialogue('aylin', line, 5);
        }
    }
}

// Update dialogues
function updateDialogues(dt) {
    activeDialogues = activeDialogues.filter(d => {
        d.timeLeft -= dt;
        d.bobOffset = Math.sin(gameState.time * 3) * 5; // Bob up and down
        return d.timeLeft > 0;
    });

    // Decrement cooldowns
    for (let char in dialogueCooldowns) {
        if (dialogueCooldowns[char] > 0) {
            dialogueCooldowns[char] -= dt;
        }
    }

    // Generate new dialogue every frame (with per-character random chances)
    generateContextDialogue();
}

// Draw dialogues
function drawDialogues() {
    for (let d of activeDialogues) {
        // Get current character position or use fallback
        let charX = d.x;
        let charY = d.y;

        if (d.characterRef && d.characterRef.obj) {
            const obj = d.characterRef.obj;
            charX = obj.x + (obj.width ? obj.width / 2 : 0);
            charY = obj.y + (obj.height ? obj.height / 2 : 0);
        }

        // Convert world coordinates to screen coordinates
        const screen = worldToScreen(charX, charY);
        const screenX = screen.x + d.bobOffset;
        const screenY = screen.y - 80 * gameState.cameraScale + (1 - d.timeLeft / (d.duration || 3)) * 20;
        const alpha = Math.max(0, d.timeLeft / (d.duration || 3));

        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;

        // Draw dialogue bubble (rounded rectangle)
        const textMetrics = ctx.measureText(d.text);
        const width = textMetrics.width + 20;
        const height = 30;
        const x = screenX - width / 2;
        const y = screenY - height / 2;
        const radius = 6;

        // Draw rounded rectangle manually
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw pointer triangle
        ctx.beginPath();
        ctx.moveTo(screenX - 5, screenY + height / 2);
        ctx.lineTo(screenX, screenY + height / 2 + 10);
        ctx.lineTo(screenX + 5, screenY + height / 2);
        ctx.closePath();
        ctx.fill();

        // Draw text with strong black border for readability
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';
        ctx.strokeText(d.text, screenX, screenY + 5);
        ctx.fillStyle = '#fff';
        ctx.fillText(d.text, screenX, screenY + 5);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
    }
}

// Game loop
let lastTime = 0;
function gameLoop() {
    const now = Date.now();
    if (lastTime === 0) lastTime = now; // Initialize on first frame
    const deltaTime = Math.min(((now - lastTime) / 1000) * playtestBot.timeScale, 0.1); // Cap at 100ms
    lastTime = now;

    update(deltaTime);
    updateDialogues(deltaTime);
    render();
    requestAnimationFrame(gameLoop);
}

// Start game
initGame();
if (AUTOSTART_PLAYTEST) {
    if (PLAYTEST_SPEEDS.includes(AUTOSTART_SPEED)) {
        playtestBot.timeScale = AUTOSTART_SPEED;
    }
    togglePlaytestBot(true);
}
gameLoop();
