# Overstimulated - Feature Implementation Checklist

## Current Status
As of latest session: ~65% of core features implemented (simplified to 2 days)

---

## ✅ IMPLEMENTED & WORKING

### Controls & Input
- [x] WASD/Arrow keys movement
- [x] Shift sprint with energy management
- [x] Space/E action button with hold mechanic
- [x] Q bark button (basic version)
- [x] R interact with NPCs (NEW - just added)
- [x] Backslash debug toggle

### Core Mechanics
- [x] Overstimulation meter (0-100%)
- [x] Sprint energy system
- [x] Collision detection with walls and doors
- [x] Door open/close mechanics
- [x] Pathfinding (waypoint-based)
- [x] Task system (spawn/complete)
- [x] Holding action button for time-based tasks

### Stress Management
- [x] Standing still reduces stress
- [x] Holding action while still provides extra calm
- [x] Relaxing on furniture (couch/bed) - FIXED locks player
- [x] Coffee buff system (stress resistance)
- [x] Toilet hiding (dramatic zoom + vignette)

### NPC Systems
- [x] Wife AI (activity-based with multiple behaviors)
- [x] Jake/Housemate AI (retreat behaviors)
- [x] Baby AI (roaming + sleeping, supervision checks)
- [x] Dogs (Momo & Piper basic AI)
- [x] Chickens (state machine - flock/flee/coop)
- [x] Munty (Day 2 chaos dog)

### Dynamic Systems
- [x] Procedural task generation
- [x] Dynamic poop/toy cleanup tasks
- [x] Wife assigns random chores
- [x] Routine chores pool
- [x] RNG events (dog barks, baby wakeup, toy spawn)
- [x] Movement slowdown on obstacles

### Dialogue & Feedback
- [x] Dialogue shout system with character voices
- [x] Context-sensitive Dad dialogue (based on stress)
- [x] Wife supportive/stressed dialogue
- [x] Baby sounds (happy/crying/tired/playful)
- [x] Dog barks and sounds
- [x] Dialogue bubbles with fade animation
- [x] Text with black borders for readability (NEW)

### Visual Feedback
- [x] AOE circles for interactive elements
- [x] Sprinkler area effect visualization
- [x] Baby crying radius
- [x] Door interaction highlights
- [x] Task location glows
- [x] NPC rendering with names
- [x] Debug menu overlay (NEW)

### Testing Features
- [x] Test items placed in living room (poop + toys)
- [x] Debug menu with gameplay controls

---

## ⏳ PARTIALLY IMPLEMENTED / NEEDS WORK

### NPC Behaviors
- [~] Wife behaviors (needs more variety, task creation still basic)
- [~] Jake behaviors (needs more defined "won't take baby" logic)
- [~] Baby mechanics (tantrums need better implementation)
- [~] Dog behaviors (bowl race needs better trigger)
- [~] Munty chaos mechanics (Day 2 - partially implemented)

### Bark Mechanic (Q key)
- [~] Basic bark implementation exists
- [ ] "Near adults → 25% task help" - needs verification
- [ ] "Near animals → follow behavior" - needs implementation
- [ ] "Near chickens → scatter" - needs implementation
- [ ] Cooldown system needs work

### Task System
- [~] Basic tasks working but need expansion
- [ ] Retrieve tasks (pickup and move to location)
- [ ] Coverage tasks (vacuum, mow) - basic there, needs more
- [ ] Multi-component tasks
- [ ] Task variety across days

---

## ❌ NOT YET IMPLEMENTED (High Priority)

### Routine Chores (from README section 2)
- [ ] Dishes spawn at 1:00, 4:30
- [ ] Chickens return to coop at 4:30
- [ ] Dogs fed at 0:30, 4:30
- [ ] Sprinkler at 0:45, 1:45, 2:45

### Routine Interactables (from README section 3)
- [ ] Couch/Bed interaction (FIXED but needs polish)
- [ ] Toilet hiding (implemented but needs timer/effects verification)
- [ ] Coffee machine interaction (one use 0-2:00)
  - [ ] Hold action at coffee machine for 10 seconds
  - [ ] Grant 60s stress resistance
- [ ] Beer fridge interaction (one use 3:00-5:00)
  - [ ] Tap to drink
- [ ] Baby's cot interaction (one use 2:00-3:00)
  - [ ] Release hold while carrying baby
  - [ ] Baby sleeps 45-60s
  - [ ] Wife retrieves baby after sleep

### Daily Challenges / Day-Specific Changes
- [x] **Day 1**: Basic gameplay (✓ done)
- [~] **Day 2**: Munty + aggressive chickens + chaos mechanics
  - [x] Aggressive chickens spawn on Day 2
  - [x] Munty spawns on Day 2
  - [ ] Action hijacking (random action fails)
  - [ ] Anti-relaxation debuff
  - [ ] Whining system (containment penalty)
  - [ ] NPC disruption effects

### Bark Mechanic Enhancements
- [ ] Adult help system (25% task progress)
- [ ] Dog following behavior
- [ ] Chicken scattering
- [ ] Context-sensitive help

### Baby Mechanics Enhancements
- [ ] Better tantrum system
- [ ] Carrying mechanic (pickup/putdown)
- [ ] Cot sleep system with wife retrieval
- [ ] Dialogue when baby is sad/demanding
- [ ] Multiple interaction types (feed, play, console)

### UI & Polish
- [ ] Day number display
- [ ] Time display (formatted as M:SS)
- [ ] Task priority indicators
- [ ] Stress level warnings (color changes)
- [ ] End-day summary
- [ ] Game over screen

### Advanced NPC Features
- [ ] Wife creating tasks dynamically
- [ ] Jake "won't take baby if in bedroom/shed" logic
- [ ] Baby tantrums with 20% failure rate
- [ ] Dog bowl race with proper triggering
- [ ] Munty's interaction hijacking
- [ ] Whining radius expansion over time

---

## 📊 FEATURE COMPLETION ESTIMATE

| Category | Completion | Notes |
|----------|-----------|-------|
| Core Mechanics | 85% | Movement, collision, tasks mostly done |
| NPCs | 70% | Basic AI works, needs behavior polish |
| Stress System | 80% | Works but missing some triggers |
| Controls | 90% | All inputs mapped, bark needs work |
| Dialogue | 85% | System works, needs more content |
| Daily Challenges | 40% | Day 2 Munty/chickens spawn, chaos mechanics partial |
| Time-based Events | 20% | Basic framework only |
| Polish | 50% | Text borders added, more needed |
| UI | 60% | Basic overlay, missing summaries |

**Overall: ~65-70% Complete** (simplified 2-day structure)

---

## 🎯 PRIORITY IMPLEMENTATION ORDER

1. **High Priority** (affects core gameplay loop):
   - [ ] Time-based routine chores (dishes, feeding, sprinkler)
   - [ ] Coffee machine interaction (full implementation)
   - [ ] Beer interaction (full implementation)
   - [ ] Baby cot sleep system
   - [ ] Munty Day 2 chaos mechanics (action hijacking, anti-relaxation, whining, NPC disruption)

2. **Medium Priority** (enhances gameplay feel):
   - [ ] Bark mechanic improvements (25% adult help)
   - [ ] Better baby tantrum system (20% uncalmable)
   - [ ] Dog bowl race for all dogs
   - [ ] More task variety
   - [ ] Better dialogue variety

3. **Lower Priority** (polish):
   - [ ] UI improvements
   - [ ] More visual effects
   - [ ] Animation plans
   - [ ] Sprite assignments
   - [ ] Sound effect placeholders

---

## 🐛 KNOWN ISSUES TO FIX

1. Couch/bed locking - JUST FIXED ✓
2. Debug minimap - JUST FIXED (now only shows in debug mode) ✓
3. Text readability - PARTIALLY FIXED (borders added) ✓
4. NPC interaction - JUST ADDED (R key) ✓

---

## 💡 NOTES FOR NEXT SESSION

- Structure simplified to 2 days (Day 1 = baseline, Day 2 = Munty chaos)
- Lawnmower, Day 3 adults-leave, Day 4 baby-sick mechanics all cut
- Focus on making Day 2 Munty chaos excellent
- Implement time-based routine chores system
- Add coffee machine and beer interactions
- Create baby cot sleep mechanic
- Build out Munty's full chaos toolkit (action hijacking, whining, anti-relax, NPC disruption)

