// World data for the mobile rebuild. Room rectangles and doors come from the desktop game's House layout
// (converted from its negative "raw" coordinates to tile coordinates, 1 tile = 32px = one LPC tile).
'use strict';
const T = 32, MAPW = 84, MAPH = 46;

const ROOMS = {
  DOG_YARD:     { x: 1,  y: 0,  w: 48, h: 46, name: 'Dog yard',       floor: 't_grass', out: true },
  CHICKEN_YARD: { x: 49, y: 0,  w: 35, h: 46, name: 'Chicken yard',   floor: 't_grass', out: true },
  SHED:         { x: 68, y: 1,  w: 14, h: 8,  name: 'Shed',           floor: 't_path' },
  CHICKEN_RUN:  { x: 72, y: 21, w: 9,  h: 20, name: 'Chicken run',    floor: 't_path' },
  CHICKEN_COOP: { x: 75, y: 33, w: 4,  h: 2,  name: 'Chicken coop',   floor: 't_wood3' },
  PATIO_MAIN:   { x: 49, y: 7,  w: 15, h: 7,  name: 'Patio',          floor: 't_path', out: true },
  PATIO_STRIP:  { x: 60, y: 14, w: 4,  h: 20, name: 'Patio strip',    floor: 't_path', out: true },
  DOG_PATIO:    { x: 6,  y: 34, w: 43, h: 5,  name: 'Dog patio',      floor: 't_path' },
  LIVING_ROOM:  { x: 29, y: 7,  w: 20, h: 27, name: 'Living room',    floor: 't_wood1', wall: 't_wall' },
  KITCHEN:      { x: 21, y: 7,  w: 8,  h: 15, name: 'Kitchen',        floor: 't_tile1', wall: 't_wall3' },
  READING:      { x: 14, y: 7,  w: 7,  h: 15, name: 'Reading room',   floor: 't_wood2', wall: 't_wall2' },
  BABYS_ROOM:   { x: 14, y: 24, w: 15, h: 10, name: "Baby's room",    floor: 't_wood3', wall: 't_wall2' },
  MASTER:       { x: 6,  y: 16, w: 8,  h: 18, name: 'Master bedroom', floor: 't_wood3', wall: 't_wall' },
  ENSUITE:      { x: 6,  y: 7,  w: 8,  h: 9,  name: 'Ensuite',        floor: 't_tile2', wall: 't_wall' },
  HOUSEMATE:    { x: 49, y: 14, w: 11, h: 7,  name: "Jake's room",    floor: 't_wood2', wall: 't_wall3' },
  OFFICE:       { x: 49, y: 23, w: 5,  h: 11, name: 'Home office',    floor: 't_wood1', wall: 't_wall' },
  SPARE:        { x: 54, y: 23, w: 6,  h: 11, name: 'Spare room',     floor: 't_wood2', wall: 't_wall3' },
  CORRIDOR_R:   { x: 49, y: 21, w: 11, h: 2,  name: 'Corridor',       floor: 't_wood3', wall: 't_wall3' },
  CORRIDOR_L:   { x: 14, y: 22, w: 15, h: 2,  name: 'Corridor',       floor: 't_wood3', wall: 't_wall3' },
};
// painting order: later entries overwrite earlier ones
const ROOM_ORDER = ['DOG_YARD', 'CHICKEN_YARD', 'SHED', 'CHICKEN_RUN', 'CHICKEN_COOP', 'PATIO_MAIN', 'PATIO_STRIP', 'DOG_PATIO',
  'LIVING_ROOM', 'KITCHEN', 'READING', 'BABYS_ROOM', 'MASTER', 'ENSUITE', 'HOUSEMATE', 'OFFICE', 'SPARE', 'CORRIDOR_R', 'CORRIDOR_L'];

// openings between rooms: orient 'v' = opening in a vertical wall at x=bx between tiles (bx-1,y)|(bx,y), spanning tiles y0..y1
// orient 'h' = opening in a horizontal wall at y=by between tiles (x,by-1)|(x,by), spanning tiles x0..x1
const DOORS = [
  { o: 'h', a: 8,  b: 16, s: 8,  e: 9 },    // ensuite <-> master
  { o: 'v', a: 14, b: 20, s: 22, e: 23 },   // master <-> corridor L
  { o: 'h', a: 15, b: 22, s: 16, e: 18 },   // reading <-> corridor L
  { o: 'h', a: 23, b: 22, s: 23, e: 25 },   // kitchen <-> corridor L
  { o: 'h', a: 20, b: 24, s: 20, e: 22 },   // baby <-> corridor L
  { o: 'v', a: 29, b: 0,  s: 22, e: 23 },   // corridor L <-> living
  { o: 'v', a: 29, b: 0,  s: 12, e: 14 },   // kitchen <-> living
  { o: 'v', a: 49, b: 0,  s: 21, e: 22 },   // living <-> corridor R
  { o: 'h', a: 52, b: 21, s: 52, e: 54 },   // corridor R <-> jake's room
  { o: 'h', a: 50, b: 23, s: 50, e: 52 },   // corridor R <-> office
  { o: 'h', a: 55, b: 23, s: 56, e: 58 },   // corridor R <-> spare
  { o: 'v', a: 49, b: 0,  s: 9,  e: 11 },   // living <-> patio
  { o: 'v', a: 60, b: 0,  s: 21, e: 22 },   // corridor R <-> patio strip
  { o: 'h', a: 35, b: 34, s: 35, e: 37 },   // living <-> dog patio
  { o: 'h', a: 7,  b: 34, s: 7,  e: 9 },    // master <-> dog patio
  { o: 'h', a: 72, b: 9,  s: 74, e: 76 },   // yard <-> shed
  { o: 'h', a: 76, b: 35, s: 76, e: 77 },   // run <-> coop
  { o: 'v', a: 72, b: 0,  s: 28, e: 30 },   // yard <-> chicken run gate
  { o: 'v', a: 49, b: 0,  s: 3,  e: 5 },    // dog yard <-> chicken yard (top gate)
  { o: 'v', a: 49, b: 0,  s: 41, e: 43 },   // dog yard <-> chicken yard (bottom gate)
];
// door rows above use: 'v' => wall at x=a, tiles s..e along y; 'h' => wall at y=b, tiles s..e along x (a is unused there)
const DOOR_NORMALISED = DOORS.map(d => d.o === 'v' ? { o: 'v', at: d.a, s: d.s, e: d.e } : { o: 'h', at: d.b, s: d.s, e: d.e });

// furniture: [sprite, room, dx, dy (tiles, sprite top-left), opts]
// opts: id (interactive), floor (non-blocking, drawn under everything), solid:false
const FURN = [
  // living room: TV on the north wall, sofa seen from behind facing it
  ['rug', 'LIVING_ROOM', 6.0, 3.2, { floor: true }],
  ['tv', 'LIVING_ROOM', 7.2, 0.2, {}],
  ['coffee_table', 'LIVING_ROOM', 8.6, 4.5, { solid: true }],
  ['sofa_back', 'LIVING_ROOM', 7.0, 7.2, { id: 'sofa' }],
  ['armchair', 'LIVING_ROOM', 3.0, 5.0, { id: 'armchair' }],
  ['lamp', 'LIVING_ROOM', 1.2, 1.0, {}],
  ['lamp', 'LIVING_ROOM', 16.5, 1.0, {}],
  ['ottoman', 'LIVING_ROOM', 13.0, 6.5, {}],
  // kitchen
  ['fridge', 'KITCHEN', 6.0, 0.0, { id: 'fridge' }],
  ['oven', 'KITCHEN', 3.5, 0.6, {}],
  ['sink', 'KITCHEN', 1.0, 1.0, { id: 'sink' }],
  ['ottoman', 'KITCHEN', 3.0, 9.0, {}],
  // reading room
  ['armchair', 'READING', 1.0, 2.0, { id: 'armchair2' }],
  ['lamp', 'READING', 5.0, 1.0, {}],
  ['ottoman', 'READING', 1.5, 10.5, {}],
  // baby's room
  ['dresser', 'BABYS_ROOM', 1.0, 0.8, {}],
  ['bed_green', 'BABYS_ROOM', 10.0, 0.8, { id: 'cot' }],
  ['rug', 'BABYS_ROOM', 8.0, 5.2, { floor: true }],
  // master bedroom
  ['dresser', 'MASTER', 4.0, 0.8, {}],
  ['bed_blue', 'MASTER', 2.5, 8.5, { id: 'bed' }],
  ['lamp', 'MASTER', 0.5, 8.0, {}],
  // ensuite
  ['toilet', 'ENSUITE', 1.0, 4.5, { id: 'toilet' }],
  ['vanity', 'ENSUITE', 1.0, 0.8, {}],
  // jake's room, office, spare
  ['bed_green', 'HOUSEMATE', 1.0, 0.8, {}],
  ['desk', 'HOUSEMATE', 6.5, 0.8, {}],
  ['desk', 'OFFICE', 0.8, 0.8, {}],
  ['office_chair', 'OFFICE', 1.5, 2.6, {}],
  ['bed_brown', 'SPARE', 3.2, 0.8, {}],
  ['chest', 'SPARE', 0.8, 6.0, { id: 'toybox' }],
  // outside
  ['mower', 'DOG_YARD', 10, 6, {}],
  ['bowl_a', 'DOG_PATIO', 30.5, 1.2, { id: 'bowls' }],
  ['bowl_b', 'DOG_PATIO', 31.8, 1.2, {}],
  ['ottoman', 'DOG_PATIO', 3.0, 1.0, {}],
  ['fridge', 'SHED', 9.5, 1.0, {}],
];

// where tasks and wandering things happen
const SPOTS = {
  toyLiving: { room: 'LIVING_ROOM', dx: 12, dy: 11 },
  toyBaby:   { room: 'BABYS_ROOM',  dx: 9,  dy: 7 },
  patioPoop: [ { room: 'PATIO_MAIN', dx: 6, dy: 3 }, { room: 'PATIO_MAIN', dx: 10, dy: 5 }, { room: 'PATIO_MAIN', dx: 3, dy: 5 } ],
};
const WANDER = {
  wife: ['KITCHEN', 'LIVING_ROOM', 'PATIO_MAIN', 'MASTER'],
  jake: ['SPARE', 'HOUSEMATE', 'OFFICE', 'CORRIDOR_R', 'LIVING_ROOM'],
  baby: ['BABYS_ROOM', 'LIVING_ROOM', 'CORRIDOR_L'],
  momo: ['LIVING_ROOM', 'DOG_PATIO', 'KITCHEN', 'DOG_YARD'],
  piper: ['LIVING_ROOM', 'DOG_YARD', 'DOG_PATIO', 'READING'],
};
