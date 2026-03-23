# Overstimulated - Feature Patch Notes

This patched version includes 4 gameplay features that enhance Dad's stress management abilities.

## 🛋️ NEW FEATURES

### 1. Relaxation Spots
- **Objects**: Couch, Bed
- **How to use**: Press E near couch or bed to sit/lie down
- **Effect**: Reduces stress faster than standing still (2.0/sec vs 0.55/sec)
- **Visual**: Green pulsing circle around furniture when relaxing

### 2. Toilet Hiding
- **Object**: Toilet
- **How to use**: Press E near toilet to hide inside
- **Effect**: 
  - Door closed: MAXIMUM stress reduction (3.0/sec) - best in game!
  - Door open: Good stress reduction (1.5/sec)
- **Strategy**: Use when overwhelmed - fastest way to recover!

### 3. Coffee Machine
- **Object**: Coffee Machine (in kitchen)
- **How to use**: Hold E for 5 seconds to brew coffee
- **Effect**: 60-second stress resistance buff
- **Visual**: Progress bar while brewing, timer display when active
- **Strategy**: Brew before expecting high stress situations

### 4. Enhanced Bark (Q key)
- **How to use**: Press Q to bark (3-second cooldown)
- **Effects**:
  - **Dogs**: Run excitedly toward you
  - **Wife/Jake**: Come to help for 5 seconds
  - **Baby**: Gets attention (might cry)
  - **Chickens**: Flee away from you
- **Range**: 150 pixels AOE effect
- **Cost**: +2.0 stress (it's loud!)
- **Strategy**: Call for help when overwhelmed or manage chickens

## 🎮 CONTROLS

- **WASD**: Move
- **Shift**: Sprint
- **E / Space**: Action (interact, toggle relax)
- **Hold E**: Brew coffee (at coffee machine)
- **Q**: Bark (call for help/manage animals)

## 📊 STRESS REDUCTION RATES

1. **Toilet (door closed)**: -3.0/sec (BEST!)
2. **Relaxation spots**: -2.0/sec
3. **Toilet (door open)**: -1.5/sec
4. **Standing still**: -0.55/sec (if <2 tasks)
5. **Coffee buff**: +0.3/sec passive reduction

## 🎯 STRATEGY TIPS

1. **Morning routine**: Brew coffee before tasks spawn
2. **Overwhelmed?** Hide in toilet with door closed
3. **Quick break**: Sit on couch between tasks
4. **Manage animals**: Use bark to call dogs or spook chickens
5. **Use bark strategically**: Call dogs, scatter chickens, or pull adults toward you

## 🔧 TECHNICAL CHANGES

### gameState additions:
- `coffeeBuff`, `coffeeBuffTimer`, `coffeeBuffDuration`
- `isRelaxing`, `relaxSpot`
- `coffeeProgress`, `coffeeBrewTime`
- `isHidingInToilet`

### New functions:
- `checkRelaxSpot()`
- `checkToiletHiding()`
- `checkCoffeeMachine()`
### Modified functions:
- `performBark()` - Now affects all NPCs and chickens
- `updateStressLogic()` - Includes all new stress mechanics
- `update()` - Enhanced action handling
- `render()` - Visual indicators for all features
- `drawHUD()` - New UI elements (coffee timer, status text)

### HTML additions:
- Coffee buff timer indicator
- Status text (relaxing/hiding/mowing)
- Interaction hint placeholder

## ✅ TESTING CHECKLIST

All features tested and working:
- ✅ Relaxation spots reduce stress
- ✅ Toilet hiding works (door state matters)
- ✅ Coffee brewing (hold-to-complete)
- ✅ Coffee buff timer display
- ✅ Enhanced bark affects all entities
- ✅ Visual indicators display correctly
- ✅ UI updates properly

## 🎉 ENJOY!

These features give you more strategic options for managing Dad's stress levels. Experiment with different combinations to find what works best for your playstyle!

---
*Patch applied: February 2026*
*Original game by: [Your Name]*
*Features designed for enhanced stress management gameplay*
