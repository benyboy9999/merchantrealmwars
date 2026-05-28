export const ResourceType = {
  // Raw — Extraction
  IRON_ORE:     'IRON_ORE',
  COPPER_ORE:   'COPPER_ORE',
  TIN_ORE:      'TIN_ORE',
  COAL:         'COAL',
  LIMESTONE:    'LIMESTONE',
  SAND:         'SAND',
  WOOD:         'WOOD',
  WATER:        'WATER',

  // Raw — Agricultural
  GRAIN:        'GRAIN',
  VEGETABLES:   'VEGETABLES',
  COTTON:       'COTTON',
  COWS:         'COWS',
  HIDE:         'HIDE',
  FERTILIZER:   'FERTILIZER',
  MULES:        'MULES',
  HORSES:       'HORSES',
  FEED:         'FEED',

  // Processed — Metals
  IRON_BARS:    'IRON_BARS',
  COPPER_BARS:  'COPPER_BARS',
  BRONZE_BARS:  'BRONZE_BARS',
  CHARCOAL:     'CHARCOAL',

  // Processed — Construction
  BRICKS:       'BRICKS',
  MORTAR:       'MORTAR',
  TIMBER_FRAME: 'TIMBER_FRAME',
  SCAFFOLDING:  'SCAFFOLDING',
  PLANKS:       'PLANKS',
  NAILS:        'NAILS',

  // Food & Drink
  RATIONS:        'RATIONS',
  DRINKING_WATER: 'DRINKING_WATER',
  ALE:            'ALE',

  // Textiles & Leather
  LEATHER:   'LEATHER',
  CLOTH:     'CLOTH',
  PARCHMENT: 'PARCHMENT',
  OVERALLS:  'OVERALLS',

  // Tools & Equipment
  TOOLS:  'TOOLS',
  WHEELS: 'WHEELS',

  // Research
  BASIC_RESEARCH: 'BASIC_RESEARCH',
} as const;

export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];
