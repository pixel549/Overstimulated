// World data for the mobile rebuild (v2 layout). The room topology follows the desktop game's House layout, but the rooms are
// redrawn at LPC scale (a sofa is ~3 tiles, a person is ~1 tile) so they read as lived-in rather than empty halls.
// 1 tile = 32px = one LPC tile.
'use strict';
const T = 32, MAPW = 60, MAPH = 36;

const ROOMS = {
  DOG_YARD:     { x: 0,  y: 0,  w: 33, h: 36, name: 'Dog yard',       floor: 't_grass', out: true },
  CHICKEN_YARD: { x: 33, y: 0,  w: 27, h: 36, name: 'Chicken yard',   floor: 't_grass', out: true },
  SHED:         { x: 46, y: 1,  w: 10, h: 5,  name: 'Shed',           floor: 't_path', wall: 't_wall3' },
  CHICKEN_RUN:  { x: 47, y: 16, w: 9,  h: 14, name: 'Chicken run',    floor: 't_path' },
  CHICKEN_COOP: { x: 50, y: 25, w: 4,  h: 3,  name: 'Chicken coop',   floor: 't_wood3', wall: 't_wall3' },
  PATIO_MAIN:   { x: 33, y: 6,  w: 10, h: 5,  name: 'Patio',          floor: 't_path', out: true },
  PATIO_STRIP:  { x: 41, y: 11, w: 2,  h: 11, name: 'Patio strip',    floor: 't_path', out: true },
  DOG_PATIO:    { x: 4,  y: 22, w: 29, h: 3,  name: 'Dog patio',      floor: 't_path', out: true },
  LIVING_ROOM:  { x: 21, y: 6,  w: 12, h: 16, name: 'Living room',    floor: 't_wood1', wall: 't_wall' },
  KITCHEN:      { x: 15, y: 6,  w: 6,  h: 9,  name: 'Kitchen',        floor: 't_tile1', wall: 't_wall3' },
  READING:      { x: 10, y: 6,  w: 5,  h: 9,  name: 'Reading room',   floor: 't_wood2', wall: 't_wall2' },
  BABYS_ROOM:   { x: 10, y: 17, w: 11, h: 5,  name: "Baby's room",    floor: 't_wood3', wall: 't_wall2' },
  MASTER:       { x: 4,  y: 11, w: 6,  h: 11, name: 'Master bedroom', floor: 't_wood3', wall: 't_wall' },
  ENSUITE:      { x: 4,  y: 6,  w: 6,  h: 5,  name: 'Ensuite',        floor: 't_tile2', wall: 't_wall' },
  HOUSEMATE:    { x: 33, y: 11, w: 8,  h: 5,  name: "Jake's room",    floor: 't_wood2', wall: 't_wall3' },
  OFFICE:       { x: 33, y: 18, w: 4,  h: 4,  name: 'Home office',    floor: 't_wood1', wall: 't_wall' },
  SPARE:        { x: 37, y: 18, w: 4,  h: 4,  name: 'Spare room',     floor: 't_wood2', wall: 't_wall3' },
  CORRIDOR_R:   { x: 33, y: 16, w: 8,  h: 2,  name: 'Corridor',       floor: 't_wood3', wall: 't_wall3' },
  CORRIDOR_L:   { x: 10, y: 15, w: 11, h: 2,  name: 'Corridor',       floor: 't_wood3', wall: 't_wall3' },
};
// painting order: later entries overwrite earlier ones
const ROOM_ORDER = ['DOG_YARD', 'CHICKEN_YARD', 'SHED', 'CHICKEN_RUN', 'CHICKEN_COOP', 'PATIO_MAIN', 'PATIO_STRIP', 'DOG_PATIO',
  'LIVING_ROOM', 'KITCHEN', 'READING', 'BABYS_ROOM', 'MASTER', 'ENSUITE', 'HOUSEMATE', 'OFFICE', 'SPARE', 'CORRIDOR_R', 'CORRIDOR_L'];

// Doors live on the wall edge between two tiles. o:'v' = in a vertical wall at x=at, on row i (between tiles (at-1,i) and (at,i));
// o:'h' = in a horizontal wall at y=at, on column i (between (i,at-1) and (i,at)). Closed doors stop dogs, chickens and the baby;
// Dad, Wife and Jake open them as they walk through. gate:true draws a fence gate instead of a door.
const DOORS = [
  { id: 'ensuite',   name: 'Ensuite door',        o: 'h', at: 11, i: 6,  w: 2, open: true },
  { id: 'master',    name: 'Master bedroom door', o: 'v', at: 10, i: 15, w: 2, open: true },
  { id: 'reading',   name: 'Reading room door',   o: 'h', at: 15, i: 12, w: 2, open: true },
  { id: 'kitchenS',  name: 'Kitchen door',        o: 'h', at: 15, i: 18, w: 2, open: true },
  { id: 'baby',      name: "Baby's room door",    o: 'h', at: 17, i: 14, w: 2, open: true },
  { id: 'hallL',     name: 'Hallway door',        o: 'v', at: 21, i: 15, w: 2, open: true },
  { id: 'kitchenE',  name: 'Kitchen archway',     o: 'v', at: 21, i: 8,  w: 2, open: true },
  { id: 'hallR',     name: 'Hallway door',        o: 'v', at: 33, i: 16, w: 2, open: true },
  { id: 'jake',      name: "Jake's door",         o: 'h', at: 16, i: 36, w: 2, open: true },
  { id: 'office',    name: 'Office door',         o: 'h', at: 18, i: 35, w: 2, open: true },
  { id: 'spare',     name: 'Spare room door',     o: 'h', at: 18, i: 38, w: 2, open: true },
  { id: 'stripDoor', name: 'Side door',           o: 'v', at: 41, i: 16, w: 2, open: false },
  { id: 'patio',     name: 'Patio door',          o: 'v', at: 33, i: 8,  w: 2, open: false },
  { id: 'dogPatioL', name: 'Living room back door', o: 'h', at: 22, i: 26, w: 2, open: true },
  { id: 'dogPatioM', name: 'Master back door',    o: 'h', at: 22, i: 6,  w: 2, open: false },
  { id: 'shed',      name: 'Shed door',           o: 'h', at: 6,  i: 50, w: 2, open: true },
  { id: 'runGate',   name: 'Chicken run gate',    o: 'v', at: 47, i: 22, w: 2, open: false, gate: true },
  { id: 'coop',      name: 'Coop hatch',          o: 'h', at: 28, i: 51, w: 2, open: false, gate: true },
  { id: 'yardTop',   name: 'Yard gate (north)',   o: 'v', at: 33, i: 2,  w: 3, open: false, gate: true },
  { id: 'yardBot',   name: 'Yard gate (south)',   o: 'v', at: 33, i: 30, w: 3, open: false, gate: true },
];

// furniture: [sprite, room, dx, dy (tiles, sprite top-left), opts]
// opts: id (interactive), floor (non-blocking, drawn under everything)
const FURN = [
  // living room: TV on the north wall, sofa seen from behind facing it, rug and coffee table between
  ['rug', 'LIVING_ROOM', 3.7, 2.8, { floor: true }],
  ['tv', 'LIVING_ROOM', 4.0, 0.2, {}],
  ['dresser', 'LIVING_ROOM', 8.3, 0.4, {}],
  ['coffee_table', 'LIVING_ROOM', 5.0, 3.5, {}],
  ['sofa_back', 'LIVING_ROOM', 4.0, 6.2, { id: 'sofa' }],
  ['armchair', 'LIVING_ROOM', 1.0, 4.3, { id: 'armchair' }],
  ['armchair', 'LIVING_ROOM', 8.8, 4.3, { id: 'armchair3' }],
  ['lamp', 'LIVING_ROOM', 0.2, 0.9, {}],
  ['lamp', 'LIVING_ROOM', 10.9, 0.9, {}],
  ['ottoman', 'LIVING_ROOM', 9.0, 9.0, {}],
  ['coffee_table', 'LIVING_ROOM', 3.0, 11.0, {}],
  // kitchen
  ['fridge', 'KITCHEN', 4.9, 0.0, { id: 'fridge' }],
  ['oven', 'KITCHEN', 3.2, 0.6, { id: 'oven' }],
  ['sink', 'KITCHEN', 1.2, 0.9, { id: 'sink' }],
  ['coffee_table', 'KITCHEN', 1.4, 4.4, {}],
  // reading room (and the dogs' favourite bed)
  ['armchair', 'READING', 0.7, 1.2, { id: 'armchair2' }],
  ['lamp', 'READING', 3.5, 0.9, {}],
  ['ottoman', 'READING', 2.6, 5.4, {}],
  // baby's room
  ['dresser', 'BABYS_ROOM', 0.8, 0.5, { id: 'dresserB' }],
  ['bed_green', 'BABYS_ROOM', 8.2, 0.4, { id: 'cot' }],
  ['rug', 'BABYS_ROOM', 4.3, 2.2, { floor: true }],
  // master bedroom and ensuite
  ['dresser', 'MASTER', 3.3, 0.3, {}],
  ['bed_blue', 'MASTER', 0.8, 3.4, { id: 'bed' }],
  ['lamp', 'MASTER', 2.6, 3.9, {}],
  ['lamp', 'MASTER', 4.3, 6.8, {}],
  ['toilet', 'ENSUITE', 0.8, 1.3, { id: 'toilet' }],
  ['vanity', 'ENSUITE', 3.6, 0.5, {}],
  // jake's room, office, spare room
  ['bed_green', 'HOUSEMATE', 0.8, 0.5, {}],
  ['desk', 'HOUSEMATE', 4.6, 0.4, { id: 'jakedesk' }],
  ['lamp', 'HOUSEMATE', 7.1, 0.9, {}],
  ['desk', 'OFFICE', 0.2, 0.3, {}],
  ['office_chair', 'OFFICE', 0.8, 1.5, {}],
  ['bed_brown', 'SPARE', 0.3, 0.4, {}],
  ['chest', 'SPARE', 2.4, 2.4, { id: 'toybox' }],
  // outside
  ['mower', 'DOG_YARD', 10, 10, { id: 'mower' }],
  ['bowl_a', 'DOG_PATIO', 24.2, 0.9, { id: 'bowls' }],
  ['bowl_b', 'DOG_PATIO', 25.5, 0.9, {}],
  ['ottoman', 'DOG_PATIO', 3.0, 0.8, {}],
  ['fridge', 'SHED', 7.5, 0.6, {}],
  ['chest', 'SHED', 1.0, 1.2, {}],
];

// where tasks happen
const SPOTS = {
  toyLiving: { room: 'LIVING_ROOM', dx: 6, dy: 9 },
  toyBaby:   { room: 'BABYS_ROOM',  dx: 4, dy: 3 },
  coopEgg: { room: 'CHICKEN_COOP', dx: 1, dy: 1 },
  patioPoop: [ { room: 'PATIO_MAIN', dx: 2, dy: 2 }, { room: 'PATIO_MAIN', dx: 5, dy: 3 }, { room: 'PATIO_MAIN', dx: 7, dy: 1 } ],
};
const WANDER = {
  wife: ['KITCHEN', 'LIVING_ROOM', 'PATIO_MAIN', 'MASTER'],
  jake: ['SPARE', 'HOUSEMATE', 'OFFICE', 'CORRIDOR_R', 'LIVING_ROOM'],
  baby: ['BABYS_ROOM', 'LIVING_ROOM', 'CORRIDOR_L'],
  momo: ['LIVING_ROOM', 'DOG_PATIO', 'KITCHEN', 'READING'],
  piper: ['LIVING_ROOM', 'DOG_PATIO', 'READING', 'DOG_YARD'],
};
