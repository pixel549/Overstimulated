# Overstimulated: Coding Architecture Guide

## Tech Stack
- **Vanilla JavaScript** (no frameworks)
- **HTML5 Canvas** for rendering
- **Python SimpleHTTPServer** for local hosting

## Project Structure
```
Overstimulated/
├── index.html          # Basic HTML wrapper with canvas
├── game.js             # Main game logic (~3000 lines)
├── style.css           # UI styling
├── map_builder.html    # Tool for designing rooms/walls
└── rebuild_walls.py    # Python script to regenerate wall data
```

## Core Architecture

### 1. World System
**TILE_SIZE**: 15px base unit
**ROOMS**: Object defining all room bounds (x, y, w, h)
**WALLS**: Array of wall rectangles that block movement
**DOORS**: Array of door objects with open/closed state
**POIS** (Points of Interest): Named locations for tasks (COUCH, SINK, etc.)
**WAYPOINTS**: Navigation graph for smart pathfinding

### 2. Game State Object
```javascript
gameState = {
    // Core
    day: 1-2,
    time: 0-300 (5 minutes per day),
    overstimulation: 0-100,
    
    // Player
    dad: { x, y, width, height, carrying, direction },
    
    // NPCs
    npcStates: {
        wife: { x, y, targetRoom, moveSpeed, canUseDoors, currentPath },
        housemate: { ... },
        baby: { ... },
        brownDog: { ... },
        blackDog: { ... },
        munty: null (spawns Day 2)
    },
    
    // Entities
    tasks: [],          // Current objectives
    chickens: [],       // Regular chickens
    aggressiveChickens: [],
    entities: [],       // Poop, toys, items
    
    // State flags
    doorsOpened: {},
    sprintergyLeft: 100,
    barkCooldown: 0,
    coffeeBuff: false,
    isMowing: false,
    // ... many more
}
```

### 3. Main Game Loop
```javascript
function gameLoop() {
    const deltaTime = (now - lastTime) / 1000;
    
    update(deltaTime);    // Game logic
    render();             // Draw to canvas
    requestAnimationFrame(gameLoop);
}
```

### 4. Update Cycle
```javascript
function update(deltaTime) {
    handleInput(deltaTime);           // WASD, Space, Q, Shift
    updatePlayer(deltaTime);          // Movement, collision
    updateNPCs(deltaTime);            // AI behaviors
    updateTasks(deltaTime);           // Task spawning/completion
    updateStress(deltaTime);          // Overstimulation meter
    updateTimers(deltaTime);          // Day progression
}
```

## Key Systems

### Input System
```javascript
const input = {
    up: false, down: false, left: false, right: false,
    action: false,        // Space/E press
    actionHeld: false,    // Space/E hold
    bark: false,          // Q
    sprinting: false      // Shift
};
```

### Movement & Collision
- **canMoveTo(x, y, w, h)**: Check if position is valid
- **canPassDoor(x, y, w, h)**: Check if doors allow passage
- **pushOutOfSolids(entity, w, h)**: Resolve wall/door collisions
- **hasLineOfSight(x1, y1, x2, y2)**: Check for clear path

### Pathfinding
**Simple System** (basic NPCs):
- Move toward target room center
- Handle door opening
- Push out of walls

**Waypoint System** (smart navigation):
- **WAYPOINTS**: Graph of named positions
- **findWaypointPath(start, end)**: BFS through waypoint graph
- **navigateToTarget(npc, x, y, dt)**: Use waypoints or line-of-sight

### Task System
**Task Types**:
- `fetch`: Go somewhere and interact
- `hold`: Stand still and hold Space
- `coverage`: Tap/hold to fill progress bar

**Task Structure**:
```javascript
{
    id: unique_id,
    type: 'fetch' | 'hold' | 'coverage',
    name: "Task name",
    location: "POI_NAME",
    progress: 0,
    maxProgress: 100,
    stressContribution: 0-10
}
```

**Task Functions**:
- `spawnTask(type, name, location, maxProgress)`
- `completeTask(taskId)`
- `findNearbyTask()`: Check if player near task POI

## NPC AI System

### AI Architecture
Each NPC has a **custom update function** called from `updateNPCs()`:

```javascript
function updateNPCs(deltaTime) {
    updateWife(gameState.npcStates.wife, deltaTime);
    updateJake(gameState.npcStates.housemate, deltaTime);
    updateBaby(gameState.npcStates.baby, deltaTime);
    updateMomo(gameState.npcStates.brownDog, deltaTime);
    updatePiper(gameState.npcStates.blackDog, deltaTime);
    if (gameState.npcStates.munty) updateMunty(gameState.npcStates.munty, deltaTime);
    
    for (const chicken of gameState.chickens) updateChicken(chicken, deltaTime, false);
    for (const chicken of gameState.aggressiveChickens) updateChicken(chicken, deltaTime, true);
}
```

### Example AI Pattern (Wife)
```javascript
function updateWife(wife, deltaTime) {
    // Priority 1: Respond to bark
    if (wife.helpingTimer > 0) {
        navigateToTarget(wife, wife.targetX, wife.targetY, deltaTime);
        wife.helpingTimer -= deltaTime;
        return;
    }
    
    // Priority 2: Activity timer system
    wife.activityTimer -= deltaTime;
    if (wife.activityTimer <= 0) {
        // Pick new activity
        const rand = Math.random();
        if (rand < 0.30) {
            wife.targetRoom = 'LIVING_ROOM'; // Couch
            wife.activityTimer = 15 + Math.random() * 10;
        } else if (rand < 0.50) {
            wife.targetRoom = 'KITCHEN';
            wife.activityTimer = 10 + Math.random() * 10;
        }
        // ... more activities
    }
    
    // Priority 3: Move to target room
    moveNPC(wife, deltaTime, ['LIVING_ROOM', 'KITCHEN', 'PATIO_MAIN']);
}
```

### Chicken State Machine
```javascript
chicken.state = 'flock' | 'flee' | 'goto_coop' | 'patrol' | 'chase'

// Flock: Follow leader chicken
// Flee: Run from threats (humans, barks, aggressive chickens)
// Goto_coop: Return to coop periodically
// Patrol: (Aggressive only) Wander and look for targets
// Chase: (Aggressive only) Chase regular chickens
```

## Rendering System

### Camera System
```javascript
const cameraX = gameState.dad.x - canvas.width / 2;
const cameraY = gameState.dad.y - canvas.height / 2;

// Draw everything relative to camera
ctx.translate(-cameraX, -cameraY);
```

### Draw Order
1. Floor tiles
2. Rooms (color-coded)
3. Walls & doors
4. Entities (poop, items)
5. NPCs (chickens, dogs, people, baby)
6. Player
7. Debug overlays (if enabled)
8. UI (tasks, meters, timer)

### Debug Mode (Backslash key)
- 5x game speed
- Red border indicator
- Show waypoints
- Show collision boxes
- Show pathfinding paths

## Important Constants

```javascript
MAX_OVERSTIMULATION = 100;
DEBUG_SPEED_MULTIPLIER = 5;
TILE_SIZE = 15;

// NPC Speeds
WIFE_SPEED = 37.5
JAKE_SPEED = 30 (slowest adult)
BABY_SPEED = 22.5 (very slow)
MOMO_SPEED = 60
PIPER_SPEED = 67.5 (fastest)
MUNTY_SPEED = 80 (chaotic)
PLAYER_BASE_SPEED = 112
PLAYER_SPRINT_MULTIPLIER = 1.5
PLAYER_MOWING_SPEED = 56 (half speed)
```

## Key Mechanics Functions

### Bark System
```javascript
function performBark() {
    const BARK_RADIUS = 150;
    
    // Spawn visual ring
    spawnAudioRing(dadX, dadY, BARK_RADIUS);
    
    // Check NPCs in range
    for (let npcKey in gameState.npcStates) {
        if (dist < BARK_RADIUS) {
            if (npcKey === 'wife' || 'housemate') {
                // Come help
                npc.helpingTimer = 5.0;
                npc.targetX = dadX;
                npc.targetY = dadY;
            }
            // Dogs get excited, chickens flee, etc.
        }
    }
}
```

### Stress System
```javascript
function updateStress(deltaTime) {
    // Decrease stress when:
    // - Standing still
    // - Relaxing on couch/bed
    // - Completing tasks
    
    // Increase stress from:
    // - Incomplete tasks
    // - Task age
    // - Proximity to problems
    // - Sprinting
    
    if (gameState.overstimulation >= MAX_OVERSTIMULATION) {
        endGame('OVERSTIMULATED');
    }
}
```

### Door System
```javascript
function toggleDoor(doorIndex) {
    DOORS[doorIndex].open = !DOORS[doorIndex].open;
    
    // Push entities out if door closes on them
    if (!DOORS[doorIndex].open) {
        pushOutOfSolids(gameState.dad, 20, 20);
        for (const npc of Object.values(gameState.npcStates)) {
            if (npc) pushOutOfSolids(npc, 20, 20);
        }
    }
}
```

## Adding New Features

### New Task Type
1. Add to task spawn logic in `update()`
2. Add handling in `handleInput()` for action button
3. Add progress tracking if needed
4. Add completion logic in `completeTask()`

### New NPC
1. Add to `gameState.npcStates` initialization
2. Create `updateNPCName(npc, deltaTime)` function
3. Call from `updateNPCs(deltaTime)`
4. Add rendering in `render()` function

### New Room/Area
1. Add to `ROOMS` object with bounds
2. Add walls to `WALLS` array (or use rebuild_walls.py)
3. Add doors to `DOORS` array
4. Add POIs if needed
5. Add waypoints for pathfinding

### New Item/Entity
1. Spawn with `gameState.entities.push({ type, x, y, ... })`
2. Add rendering in `render()` entity loop
3. Add interaction in `handleInput()` if needed
4. Add cleanup/removal logic

## Critical Functions Reference

**Movement**: `updatePlayer()`, `moveNPC()`, `navigateToTarget()`
**Collision**: `canMoveTo()`, `pushOutOfSolids()`, `hasLineOfSight()`
**Tasks**: `spawnTask()`, `completeTask()`, `findNearbyTask()`
**NPCs**: `updateWife()`, `updateJake()`, `updateBaby()`, `updateMomo()`, `updatePiper()`, `updateMunty()`
**Chickens**: `updateChicken()`, `fleeFromPoint()`, `smartFleeFromPoint()`
**Pathfinding**: `findPath()`, `findWaypointPath()`, `findNearestWaypoint()`
**Utilities**: `distBetween()`, `getRoomAt()`, `findNearestEntity()`
**Input**: `handleInput()`, `performBark()`, `toggleDoor()`

## Common Pitfalls

1. **Always check `if (npc)` before using** - munty is null until Day 2
2. **Use `deltaTime` for all movement** - or 5x debug speed breaks things
3. **Call `pushOutOfSolids()` after movement** - prevents wall clipping
4. **Check door state before movement** - use `canPassDoor()`
5. **Don't modify `updateNPCs()` dispatcher** - it must call all custom AI functions
6. **Waypoint paths can be empty** - always check before accessing
7. **Task names can be null** - check before using `.startsWith()`

## Performance Notes

- Game runs at 60 FPS target
- ~20 active entities (NPCs + chickens + items)
- Simple axis-aligned bounding box collision
- Waypoint pathfinding only when needed (lazy evaluation)
- Canvas clears and redraws entire scene every frame

## Extending the Game

**Easy Additions**:
- New task types (copy existing patterns)
- New items/props (add to entities array)
- New POIs (add to POIS object)
- UI improvements (modify updateUI())

**Medium Additions**:
- New NPC behaviors (requires custom AI function)
- New rooms (requires wall/door/waypoint setup)
- New game mechanics (requires state tracking)

**Hard Additions**:
- Save/load system (need to serialize gameState)
- Multiplayer (entire architecture would need rework)
- Procedural generation (hardcoded world design currently)
