# Overstimulated: Personal Space Invaders

A strategy-puzzle game where you play a dad trying to survive 2 increasingly chaotic days by managing household tasks while keeping your stress (overstimulation) meter under control.

## How to Play

### Controls
- **WASD** or **Arrow Keys**: Move around the house
- **Shift**: Sprint (1.5X speed, costs stamina)
- **Space** or **E**: Quick action (pick up items, complete tasks)
- **Hold Space**: Commit time to longer tasks (dishes, playing with baby, etc.)
- **Q**: Bark (context-sensitive help/distraction)
  - Near adults → they help with the nearest task (25%)
  - Near animals → they follow you (stress relief)
  - Near chickens → they scatter
- **Backslash (\)**: Toggle Debug Mode (5X speed, shows walls/doors)

### Objective
Complete enough tasks each day to advance. If your stress meter hits 100%, you storm off and the run ends.

Your stress decreases when you:
- Stand still 
- Stand still and relax (hold the action button)
- Complete tasks
- Perform certain actions in the environment to de-stress

Your stress increases from:
- Incomplete tasks piling up
- Tasks staying longer on the to-do list
- Time passing in chaos
- Proximity to active problems

## Game Structure

### 2 Days of Increasing Difficulty
- **Day 1**: Manageable chaos - learn the ropes, fewer tasks, slower spawning
- **Day 2**: Munty joins - aggressive chickens arrive, chaos dog disrupts everything

Each day ends after a few minutes of game time, and you need to have managed the chaos to survive.

### Task Types

**Interact Tasks** 📦
- Travel to a location and interact with something
- Examples: Get beer from shed, collect chicken poop

**Retrieve Tasks** 📦
- Travel to a location, pick something up, and move it to another location
- Examples: Put baby down for a nap, move sprinkler, take rubbish out

**Coverage Tasks** 🧹
- Perform an action that will cover a location
- Examples: vacuum floors, mow lawn
- Tap multiple times to complete, or hold to work continuously

**Hold Tasks** ⏱️
- Commit time standing still to complete
- Examples: Do dishes, cuddle dogs, feed baby
- Hold Space to progress through the timer

Some tasks will involve multiple components.

## House Layout

The house is divided into rooms with points of interest (POIs):

- **Living Room**: Couch (relax), Toys (cleanup)
- **Kitchen**: Sink (dishes), various food tasks
- **Bedroom & Ensuite**: Best places to relax and reduce stress
- **Baby's Room**: Tend to the baby
- **Reading Room**: Quiet spot with dog water
- **Hallway**: Central routing
- **Patio**: Clean chicken poop
- **Yards**: Lawn mowing, feed animals
- **Shed**: Get beer (iconic task!)

## Tips to Survive

1. **Triage**: You can't do everything. Prioritize high-stress tasks
2. **Relax strategically**: Heading to bed or couch briefly cuts stress
3. **Movement helps**: Keep moving between tasks for stress relief
4. **Plan routes**: Multi-task by moving toward distant goals
5. **Stay ahead**: Complete tasks before they cause stress spikes
6. **Use variety**: Different task types give different stress relief

## Game Mechanics

### Sprint System
- Hold Shift while moving to sprint at 1.5X speed
- Sprinting drains energy (green bar at bottom right)
- Sprinting causes a small stress increase

### Bark Mechanic
- Press Q to bark (3-second cooldown)
- **Near adults**: They help with the closest task (25% progress boost)
- **Near dogs**: They focus on the player and follow
- **Near baby**: Might calm him down (might not though)
- **Near chickens**: They scatter.

### Collision & World
- Walls block movement between rooms
- Doors exist between rooms. Need to be opened and closed. Other adults can open and close doors, other NPCs cannot.
- Real spatial navigation required
- Room names visible in map labels

### NPCs
A number of NPCs are present and add various obstacles and boons. 
## NPCs: Behavioral AI Systems

NPCs use priority-based AI with activity timers and room targeting. They can pathfind through doors, creating dynamic household traffic that the player must navigate around.

### The Adults

**Wife (W)**
- **Speed:** 37.5 | **Starting room:** Kitchen
- **Activity-based AI** with randomized timers:
  - 30%: Couch relaxation (15-25s)
  - 20%: Kitchen work (10-20s)
  - 20%: Patio visits (8-15s, randomly picks PATIO_MAIN or PATIO_STRIP)
  - 30%: Roaming (5-10s, cycles KITCHEN → LIVING_ROOM → BABYS_ROOM → MASTER_BEDROOM)
- **Design intent:** "Often productive but sometimes brings baby or adds to todo list without doing chore"
- Can be called with bark (Q) near tasks for 25% progress boost
- Unpredictable helper—might create work instead of doing it

**Housemate Jake (J)**
- **Speed:** 30 (slowest adult) | **Starting room:** Housemate's Room
- **Activity-based AI** with longer retreat timers:
  - 25%: Bedroom retreat (20-35s) — longest duration activity
  - 15%: Shed escape (15-25s)
  - 20%: Kitchen visit (10-18s)
  - 40%: Couch time (12-22s)
- **Design intent:** "Won't take baby if in bedroom or shed. Tidies up toys or kitchen when out"
- The detached housemate who retreats to private spaces
- Slowest movement creates pathfinding obstacles

**Baby (B)**
- **Speed:** 15 (extremely slow) | **Starting room:** Living room
- **Activity-based AI** with supervision check. Must have an adult in the room or adjacent room, otherwise tantrum. Player also cannot abandon baby - dialogue shout will tell player why they can't leave the room.
- Default behaviour: Roaming (8-15s, 70% LIVING_ROOM / 30% KITCHEN)
- Will go outside if outside doors are open
- RNG: Will have a tantrum. Actions to calm include picking up, putting down, playing, picking up toys, feeding. 20% chance no actions will stop tantrum.
- Can be carried to cot in BABY_ROOM and put to sleep for ~1 minute, at which point it can be left unattended.
- After nap time, WIFE will immediately collect baby from cot.
- **Movement:** Player is forced to 30 speed during moveNPC() call (vs base 37.5)
- **Design intent:** "Needs adult in room unless asleep in baby room. Will cry when player doesn't do what he wants"
- Creates constant supervision pressure—can't be left alone outside baby's room

### The Dogs: Priority Hierarchy AI

All three dogs share a priority system with the dog bowls race as Priority 1.

**Momo (M) - Brown Dog**
- **Speed:** 60 | **Starting room:** Living room
- **Priority 1:** DOG_BOWLS race (triggered when player within 150px of bowls)
  - Speed boost: 2x (120 effective speed)
  - Pathfinding: `['LIVING_ROOM', 'DOG_PATIO', 'MASTER_BEDROOM']`
- **Priority 2:** Kitchen attraction (if wife/jake/dad in kitchen)
  - Pathfinding: `['KITCHEN', 'LIVING_ROOM']`
- **Priority 3:** Follow closest adult
  - Maintains 40px following distance
  - If too close (<10px): backs off at 0.5x speed
  - If no humans nearby (>300px): follows Piper instead
- **Design intent:** "Follows adults closely, avoids baby, gets excited when player interacts with baby/piper"
- Player cannot relax while Momo is in their space
- The clingy velcro dog—always underfoot

**Piper (P) - Black Dog**
- **Speed:** 67.5 (fastest) | **Starting room:** Dog yard
- **Priority 1:** DOG_BOWLS race (triggered when player within 150px of bowls)
  - Speed boost: 2x (135 effective speed)
  - Pathfinding: `['LIVING_ROOM', 'DOG_PATIO', 'MASTER_BEDROOM']`
- **Priority 2:** Behavior state machine (changes every 10-15 seconds)
  - 50%: Kitchen loitering (wants food)
  - 25%: Sleep on couch or reading room (returns immediately from updatePiper, no movement)
  - 25%: Ignore (slow roaming: `['KITCHEN', 'LIVING_ROOM', 'READING__DOG_ROOM']`)
- **Design intent:** "Around kitchen (wants food), sometimes plays/sleeps/ignores barks. Won't blindly follow player outside"
- Independent food-motivated dog with attitude

**Munty (m) - Chaos Dog (Day 2 Only)**
- **Speed:** 55 | **Spawns:** Day 2 initialization
- **Priority 1:** DOG_BOWLS race (triggered within 150px of bowls)
  - Speed boost: 2.5x (137.5 effective speed - guaranteed winner)
  - Pathfinding: `['LIVING_ROOM', 'DOG_PATIO', 'MASTER_BEDROOM']`
- **Priority 2:** Chaotic person-chasing
  - Finds nearest person (including baby)
  - Movement: 1.5x deltaTime multiplier
  - Jitter: ±20px random offset on target coordinates (erratic movement)
  - Fallback: chaotic roaming `['LIVING_ROOM', 'KITCHEN', 'DOG_YARD', 'CHICKEN_YARD']`, spawning generic mess at random intervals (6-20 seconds)
- **Fence ignoring:** Munty bypasses fence collision - can phase into chicken yard freely. slowed to 10px as he travels across the fence line
- **Visual effects:**
  - `munty.vibrate += deltaTime * 10` (continuously increments)
  - Render offset: `(sin(vibrate) * 2, cos(vibrate * 1.3) * 2)`
  - Color pulse: `rgb(255 * (sin(vibrate * 2) * 0.5 + 0.5), 0, 0)` (pulsing red)
  - Lowercase 'm' vs other NPCs' uppercase letters

**Chaos Mechanics:**

*Player Interference:*
- **Action hijacking:** When Munty within proximity of player, random chance to intercept Space/E presses (action fails or triggers wrong task)
- **Underfoot stumbling:** If Munty occupies same tile as player, applies 1.0s movement slow debuff
- **Anti-relaxation:** If player standing still to reduce stress AND Munty within range → inverts stress reduction to stress gain
  - Directly counters the core stress-reduction mechanic
  - Forces player to keep moving even when overstimulated

*NPC Disruption:*
- **Baby tantrums:** When Munty within proximity of baby → triggers crying state, generates new "Calm baby" task
- **Adult upset states:** When Munty near Wife or Jake → they stop helping, become obstacles
  - Wife: Won't respond to bark calls, might create additional tasks
  - Jake: Retreats to bedroom/shed for extended periods (2x normal timer)
  - Wife and Jake can still opt to play with Munty and will prioritise it when barked at on Day Five.

*Containment Punishment (Whining System):*
- **Trigger:** Munty locked in any room via closed doors
- **Whining mechanics:**
  - Starts at small radius (50px AOE)
  - Volume/radius increases over time: `whineRadius += deltaTime * 20`
  - Eventually covers entire play area (~700px radius)
  - Effect while in AOE: +1.5 overstimulation/sec (stacks with other stress sources)
  - Only stops when Munty freed from containment

*Spatial Chaos:*
- **Fence phasing:** Munty can cross CHICKEN_YARD/DOG_YARD walls
  - Chases chickens freely, creating cross-yard panic
  - Can't be contained by outdoor fences

**Design Intent:**
Munty is an active sabotage agent. He:
- Breaks the player's core stress-reduction mechanic (standing still)
- Hijacks inputs during critical moments
- Creates cascading NPC failures (baby tantrum → wife upset → Jake retreats)
- Punishes containment attempts with escalating area denial
- Cannot be fenced away from chickens
- Wins every dog bowl race, creating maximum traffic chaos

Day 2 isn't about managing chaos—it's about surviving active opposition.

**Counter-strategies:**
- Keep moving (can't relax anyway with Munty around)
- Lead Munty away from critical rooms before attempting tasks
- Accept that some tasks will be hijacked—build time buffer
- Baby supervision becomes impossible—triage baby tasks vs other priorities
- Lock Munty away strategically, as he will become a bigger problem if trapped

### The Chickens: State Machine AI

**Regular Chickens (3)**
- **Speed:** 20-30 (randomized on init)
- **Starting location:** CHICKEN_RUN with giant gate open
- **Poop timer:** 6-20s (1.5x faster when fleeing); only applies on patio surfaces

**State machine:**
```
FLOCK STATE:
  - Leader (chicken[Aylin]): Picks new target every 5-10s
    - 40% bias toward house door positions
    - 60% random point in CHICKEN_YARD
    - When adults are outside, Aylin follows those characters at a range of 61-100px
  - Followers (chicken[Morticia, Wednesday]): Follow leader with ±40px offset. If more than 150px away, will run to rejoin flock.
  - Flee check: Human within 60px OR aggressive chicken within 90px OR in player bark AOE OR other sounds (baby crying, dog barking, etc)
  - Coop visit: 2% chance per frame → GOTO_COOP state (3-8s, stops pooping)
  - When on patio surfaces, chickens will drop poop every ~6-12 seconds

FLEE STATE:
  - Run away from threat
  - Timer: 1.5s + random
  - Poop multiplier: 2.5x
  - Speed multiplier: 1.5x
  - Returns to FLOCK when timer expires

GOTO_COOP STATE:
  - Navigate to chicken coop
  - No pooping during coop visit
  - Returns to FLOCK after timer
```

**Aggressive Chickens (Chicken [Morag, Martha])**
- **State machine:**
```
PATROL STATE:
  - Pick target every 4-6s
  - 60% bias toward house doors
  - 40% random chicken yard point
  - Chase trigger: Regular chicken within 150px
  - When on patio surfaces, chickens will drop poop every ~6-12 seconds

CHASE STATE:
  - Target nearest regular chicken (within 200px)
  - Speed boost: 1.3x
  - Duration: 3-5s or until no target
  - Returns to PATROL
```

**Collision:**
- All NPCs call `pushOutOfSolids(npc, width, height)` after movement
- Prevents clipping into walls or closed doors
- Creates realistic traffic jams in corridors

### Design Philosophy

**Reactive chaos:**
- NPCs don't exist to help—they exist to create dynamic problems
- Wife might help OR create tasks (unpredictable productivity)
- Dogs create bowl-race traffic jams 3x per game
- Baby forces route planning around supervision
- Jake occupies key rooms at inconvenient times
- Chickens create endless poop + panic stress

**Escalation:**
- Day 1: Manageable NPC chaos
- Day 2: Munty weaponizes the entire system
- No upgrades or nerfs—player must adapt strategy

**Spatial pressure:**
- Real pathfinding means NPCs block doorways
- Slow NPCs (Jake: 30, Baby: 15) create obstacles
- Fast NPCs (Piper: 67.5, Munty: chaotic) create unpredictability
- Dog bowl races cause synchronized movement—3 dogs converging creates chokepoints

### Plans per Day
Every day includes the following:
1. Procedural chores
- These will occur based on NPC behaviours and player engagement. The player may be able to manage them down into not happening or reducing their impact.
	a. Chickens poop on the patio
	b. baby tantrum
	c. baby gets toys out and spreads them through the living room and kitchen
	d. dogs bark if surprised while sleeping
	e. dogs chase the chickens
	f. baby upsets the dogs

2. Routine chores 
- These happen every day at the same time.
	a. dishes spawn at 1, 4:30
	b. Chickens back in coop around 4:30
	c. Dogs fed at 0:30 and 4:30
	d. Sprinkler at 1:45 and 2:45

3. Routine interactables
- Environmental elements that can be interacted with every day. Some have time requirements and/or restrictions
	a. Couch, bed, toilet - can be used to reduce overstimulation. all day, no restrictions (tap to lock on) 
	b. All NPCs - all day, no restrictions (hold to chat / play)
		i. Incomplete interactions with baby cause tantrums
		ii. End of interaction with Momo will cause him to become excited 
	c. Coffee machine - one use only from 0-2 (hold action at coffee machine in kitchen for 10 seconds to make coffee)
	d. Beer - one use only from 3-5 (tap fridge in shed to use)
	e. Baby's cot - one use only from 2-3 (release hold while carrying baby to place) 
		i. Baby gets worse if not put down in that time. Baby sleeps for 0:45-1:00 minutes (some RNG) unless woken on purpose

4. Actual RNG
- Dogs barking / chasing something along the fence line - not guaranteed to happen every day, far less likely to happen inside.
- Baby waking - when put to bed for his nap, the baby will wake up somewhere between 45 and 60 seconds after. Wife will beeline to get baby out of cot when he wakes.

5. Daily challenges
- Each day comes with specific tasks to complete alongside the default and procedural ones.
	a. Day One - No extra responsibilities. Learn the house, manage the basics.
	b. Day Two - Munty the chaos dog joins, along with two aggressive chickens. Maximum chaos.

## Game Design Philosophy

This game captures the feeling of being a parent/caregiver managing multiple demands:
- No "perfect clear" - you're managing chaos, not conquering it
- Reactive systems - NPCs and mess create problems while you're busy elsewhere
- Escalating difficulty - each day gets genuinely harder
- No upgrades or power-ups - just better strategy and prioritization
- Fair loss state - if you get overwhelmed, you've failed to manage the chaos
- Spatial puzzle - routes between tasks matter, walls create constraints

## Development

Built with vanilla JavaScript and HTML5 Canvas.

To run:
```bash
python -m http.server 8000
# Then visit http://localhost:8000
```

Enjoy the chaos!
