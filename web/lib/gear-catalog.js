// What you can circle when you add gear. Not every model ever made: the common ones, and OTHER to write your own.

export const RACKETS = {
  BABOLAT: ['PURE AERO 98', 'PURE AERO', 'PURE AERO RAFA', 'PURE DRIVE', 'PURE DRIVE 98', 'PURE STRIKE 97', 'PURE STRIKE 100'],
  WILSON: ['BLADE 98', 'BLADE 100', 'PRO STAFF 97', 'CLASH 100', 'ULTRA 100', 'SHIFT 99'],
  HEAD: ['SPEED MP', 'SPEED PRO', 'RADICAL MP', 'GRAVITY MP', 'EXTREME MP', 'PRESTIGE MP', 'BOOM MP'],
  YONEX: ['EZONE 98', 'EZONE 100', 'VCORE 98', 'VCORE 100', 'PERCEPT 97'],
  TECNIFIBRE: ['TF40', 'TFIGHT', 'TF-X1'],
  DUNLOP: ['CX 200', 'SX 300', 'FX 500'],
  PRINCE: ['PHANTOM 100', 'TOUR 100'],
};

export const SHOES = {
  NIKE: ['VAPOR 12', 'VAPOR PRO', 'GP CHALLENGE PRO', 'GP CHALLENGE 1'],
  ADIDAS: ['BARRICADE', 'SOLEMATCH CONTROL', 'UBERSONIC', 'CYBERSONIC'],
  ASICS: ['GEL-RESOLUTION', 'SOLUTION SPEED FF', 'COURT FF', 'GEL-CHALLENGER'],
  'NEW BALANCE': ['CT-RALLY', 'COCO', '996'],
  YONEX: ['ECLIPSION', 'AD-ACCEL', 'SONICAGE'],
  ON: ['THE ROGER PRO'],
  'K-SWISS': ['HYPERCOURT EXPRESS', 'ULTRASHOT'],
};

export const COLORS = [
  ['WHITE', '#f4f1ea'], ['BLACK', '#25272d'], ['VOLT', '#dcf20c'], ['LIME', '#a9dc3a'], ['TEAL', '#1fa59a'], ['GREEN', '#2e8b57'],
  ['ORANGE', '#f26a1b'], ['RED', '#d93a30'], ['PINK', '#ee7bb0'], ['BLUE', '#2f6fd8'], ['NAVY', '#1e2d55'], ['GREY', '#a3a29d'],
];

/** String name and the color it is out of the packet. */
export const STRINGS = [
  ['RPM BLAST', '#34363b'], ['ALU POWER', '#c9ccd1'], ['HYPER-G', '#3f9a4c'], ['LYNX TOUR', '#e3cf7c'], ['4G', '#c9a64a'],
  ['POLY TOUR PRO', '#e8d53a'], ['POLY TOUR REV', '#7a5bd1'], ['TOUR BITE', '#b9bec4'], ['CONFIDENTIAL', '#4a4d52'],
  ['NXT', '#f1ead2'], ['X-ONE BIPHASE', '#efe2bf'], ['SYNTHETIC GUT', '#fbfaf3'], ['NATURAL GUT', '#e9dcb4'],
];
export const stringColor = (name) => (STRINGS.find(([n]) => n === name) || [null, '#fbfaf3'])[1];

export const GAUGES = ['15L', '16', '16L', '17', '18'];

/** The frame's paint, by model line. */
const PAINT = [
  ['PURE AERO', '#f2c418'], ['PURE DRIVE', '#2a6fd6'], ['PURE STRIKE', '#f4f1ea'], ['BLADE', '#3d6b4a'], ['PRO STAFF', '#25272d'],
  ['CLASH', '#d23a2e'], ['ULTRA', '#2a5bd6'], ['SHIFT', '#d9d2f0'], ['SPEED', '#f4f1ea'], ['RADICAL', '#f08a24'],
  ['GRAVITY', '#d84a6a'], ['EXTREME', '#f2d21b'], ['PRESTIGE', '#8a1d2a'], ['BOOM', '#2fb5a8'], ['EZONE', '#2a4fbf'],
  ['VCORE', '#c4202f'], ['PERCEPT', '#2f6b4f'], ['TF', '#25272d'], ['CX', '#25272d'], ['SX', '#f2c418'], ['FX', '#2a5bd6'],
];
export const paintOf = (name) => (PAINT.find(([k]) => String(name || '').toUpperCase().includes(k)) || [null, '#f4f1ea'])[1];
