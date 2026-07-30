export type PairCategory =
  | "initial"
  | "consonant-cluster"
  | "longer-word"
  | "review";

export interface PronunciationPair {
  id: string;
  sequence: number;
  leftWord: string;
  rightWord: string;
  category: PairCategory;
  difficulty: 1 | 2 | 3;
}

/**
 * Canonical lesson sequence supplied by the product owner.
 * Repetitions are intentional and must remain.
 * The only requested correction was cloudy/crowded -> cloud/crowd.
 */
export const pronunciationPairs: PronunciationPair[] = [
  {
    "id": "lace-race-1",
    "sequence": 1,
    "leftWord": "lace",
    "rightWord": "race",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lack-rack-1",
    "sequence": 2,
    "leftWord": "lack",
    "rightWord": "rack",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lag-rag-1",
    "sequence": 3,
    "leftWord": "lag",
    "rightWord": "rag",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "laid-raid-1",
    "sequence": 4,
    "leftWord": "laid",
    "rightWord": "raid",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lake-rake-1",
    "sequence": 5,
    "leftWord": "lake",
    "rightWord": "rake",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lamb-ram-1",
    "sequence": 6,
    "leftWord": "lamb",
    "rightWord": "ram",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lamp-ramp-1",
    "sequence": 7,
    "leftWord": "lamp",
    "rightWord": "ramp",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lane-rain-1",
    "sequence": 8,
    "leftWord": "lane",
    "rightWord": "rain",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lap-rap-1",
    "sequence": 9,
    "leftWord": "lap",
    "rightWord": "rap",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lash-rash-1",
    "sequence": 10,
    "leftWord": "lash",
    "rightWord": "rash",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "late-rate-1",
    "sequence": 11,
    "leftWord": "late",
    "rightWord": "rate",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "law-raw-1",
    "sequence": 12,
    "leftWord": "law",
    "rightWord": "raw",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lay-ray-1",
    "sequence": 13,
    "leftWord": "lay",
    "rightWord": "ray",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lead-read-1",
    "sequence": 14,
    "leftWord": "lead",
    "rightWord": "read",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "leak-reek-1",
    "sequence": 15,
    "leftWord": "leak",
    "rightWord": "reek",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "leap-reap-1",
    "sequence": 16,
    "leftWord": "leap",
    "rightWord": "reap",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "led-red-1",
    "sequence": 17,
    "leftWord": "led",
    "rightWord": "red",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lend-rend-1",
    "sequence": 18,
    "leftWord": "lend",
    "rightWord": "rend",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lent-rent-1",
    "sequence": 19,
    "leftWord": "lent",
    "rightWord": "rent",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lice-rice-1",
    "sequence": 20,
    "leftWord": "lice",
    "rightWord": "rice",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lid-rid-1",
    "sequence": 21,
    "leftWord": "lid",
    "rightWord": "rid",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lie-rye-1",
    "sequence": 22,
    "leftWord": "lie",
    "rightWord": "rye",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "life-rife-1",
    "sequence": 23,
    "leftWord": "life",
    "rightWord": "rife",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "light-right-1",
    "sequence": 24,
    "leftWord": "light",
    "rightWord": "right",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "limb-rim-1",
    "sequence": 25,
    "leftWord": "limb",
    "rightWord": "rim",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "link-rink-1",
    "sequence": 26,
    "leftWord": "link",
    "rightWord": "rink",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lip-rip-1",
    "sequence": 27,
    "leftWord": "lip",
    "rightWord": "rip",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "load-road-1",
    "sequence": 28,
    "leftWord": "load",
    "rightWord": "road",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "loam-roam-1",
    "sequence": 29,
    "leftWord": "loam",
    "rightWord": "roam",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lock-rock-1",
    "sequence": 30,
    "leftWord": "lock",
    "rightWord": "rock",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "locket-rocket-1",
    "sequence": 31,
    "leftWord": "locket",
    "rightWord": "rocket",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "look-rook-1",
    "sequence": 32,
    "leftWord": "look",
    "rightWord": "rook",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "loom-room-1",
    "sequence": 33,
    "leftWord": "loom",
    "rightWord": "room",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "loot-root-1",
    "sequence": 34,
    "leftWord": "loot",
    "rightWord": "root",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "louse-rouse-1",
    "sequence": 35,
    "leftWord": "louse",
    "rightWord": "rouse",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "low-row-1",
    "sequence": 36,
    "leftWord": "low",
    "rightWord": "row",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lug-rug-1",
    "sequence": 37,
    "leftWord": "lug",
    "rightWord": "rug",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lush-rush-1",
    "sequence": 38,
    "leftWord": "lush",
    "rightWord": "rush",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "lust-rust-1",
    "sequence": 39,
    "leftWord": "lust",
    "rightWord": "rust",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "blade-braid-1",
    "sequence": 40,
    "leftWord": "blade",
    "rightWord": "braid",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "bleed-breed-1",
    "sequence": 41,
    "leftWord": "bleed",
    "rightWord": "breed",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "blew-brew-1",
    "sequence": 42,
    "leftWord": "blew",
    "rightWord": "brew",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "blink-brink-1",
    "sequence": 43,
    "leftWord": "blink",
    "rightWord": "brink",
    "category": "initial",
    "difficulty": 1
  },
  {
    "id": "bloom-broom-1",
    "sequence": 44,
    "leftWord": "bloom",
    "rightWord": "broom",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "blouse-browse-1",
    "sequence": 45,
    "leftWord": "blouse",
    "rightWord": "browse",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "blush-brush-1",
    "sequence": 46,
    "leftWord": "blush",
    "rightWord": "brush",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "clam-cram-1",
    "sequence": 47,
    "leftWord": "clam",
    "rightWord": "cram",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "clash-crash-1",
    "sequence": 48,
    "leftWord": "clash",
    "rightWord": "crash",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "class-crass-1",
    "sequence": 49,
    "leftWord": "class",
    "rightWord": "crass",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "clean-cream-1",
    "sequence": 50,
    "leftWord": "clean",
    "rightWord": "cream",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "climb-crime-1",
    "sequence": 51,
    "leftWord": "climb",
    "rightWord": "crime",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "clown-crown-1",
    "sequence": 52,
    "leftWord": "clown",
    "rightWord": "crown",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "clue-crew-1",
    "sequence": 53,
    "leftWord": "clue",
    "rightWord": "crew",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "flesh-fresh-1",
    "sequence": 54,
    "leftWord": "flesh",
    "rightWord": "fresh",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "flight-fright-1",
    "sequence": 55,
    "leftWord": "flight",
    "rightWord": "fright",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "fly-fry-1",
    "sequence": 56,
    "leftWord": "fly",
    "rightWord": "fry",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "glass-grass-1",
    "sequence": 57,
    "leftWord": "glass",
    "rightWord": "grass",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "glow-grow-1",
    "sequence": 58,
    "leftWord": "glow",
    "rightWord": "grow",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "glue-grew-1",
    "sequence": 59,
    "leftWord": "glue",
    "rightWord": "grew",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "play-pray-1",
    "sequence": 60,
    "leftWord": "play",
    "rightWord": "pray",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "splint-sprint-1",
    "sequence": 61,
    "leftWord": "splint",
    "rightWord": "sprint",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "alive-arrive-1",
    "sequence": 62,
    "leftWord": "alive",
    "rightWord": "arrive",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "collect-correct-1",
    "sequence": 63,
    "leftWord": "collect",
    "rightWord": "correct",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "election-erection-1",
    "sequence": 64,
    "leftWord": "election",
    "rightWord": "erection",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "belly-berry-1",
    "sequence": 65,
    "leftWord": "belly",
    "rightWord": "berry",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "glassy-grassy-1",
    "sequence": 66,
    "leftWord": "glassy",
    "rightWord": "grassy",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "glowing-growing-1",
    "sequence": 67,
    "leftWord": "glowing",
    "rightWord": "growing",
    "category": "consonant-cluster",
    "difficulty": 2
  },
  {
    "id": "clowning-crowning-1",
    "sequence": 68,
    "leftWord": "clowning",
    "rightWord": "crowning",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "fly-fry-2",
    "sequence": 69,
    "leftWord": "fly",
    "rightWord": "fry",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "flying-frying-1",
    "sequence": 70,
    "leftWord": "flying",
    "rightWord": "frying",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "play-pray-2",
    "sequence": 71,
    "leftWord": "play",
    "rightWord": "pray",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "playing-praying-1",
    "sequence": 72,
    "leftWord": "playing",
    "rightWord": "praying",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "blue-brew-1",
    "sequence": 73,
    "leftWord": "blue",
    "rightWord": "brew",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "blooming-brooming-1",
    "sequence": 74,
    "leftWord": "blooming",
    "rightWord": "brooming",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "blush-brush-2",
    "sequence": 75,
    "leftWord": "blush",
    "rightWord": "brush",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "blushing-brushing-1",
    "sequence": 76,
    "leftWord": "blushing",
    "rightWord": "brushing",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "clash-crash-2",
    "sequence": 77,
    "leftWord": "clash",
    "rightWord": "crash",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "clashing-crashing-1",
    "sequence": 78,
    "leftWord": "clashing",
    "rightWord": "crashing",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "climb-crime-2",
    "sequence": 79,
    "leftWord": "climb",
    "rightWord": "crime",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "climbing-criming-1",
    "sequence": 80,
    "leftWord": "climbing",
    "rightWord": "criming",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "cloud-crowd-1",
    "sequence": 81,
    "leftWord": "cloud",
    "rightWord": "crowd",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "flea-free-1",
    "sequence": 82,
    "leftWord": "flea",
    "rightWord": "free",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "flesh-fresh-2",
    "sequence": 83,
    "leftWord": "flesh",
    "rightWord": "fresh",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "flight-fright-2",
    "sequence": 84,
    "leftWord": "flight",
    "rightWord": "fright",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "flute-fruit-1",
    "sequence": 85,
    "leftWord": "flute",
    "rightWord": "fruit",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "glue-grew-2",
    "sequence": 86,
    "leftWord": "glue",
    "rightWord": "grew",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "light-right-2",
    "sequence": 87,
    "leftWord": "light",
    "rightWord": "right",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "long-wrong-1",
    "sequence": 88,
    "leftWord": "long",
    "rightWord": "wrong",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "list-wrist-1",
    "sequence": 89,
    "leftWord": "list",
    "rightWord": "wrist",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "law-raw-2",
    "sequence": 90,
    "leftWord": "law",
    "rightWord": "raw",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "lead-read-2",
    "sequence": 91,
    "leftWord": "lead",
    "rightWord": "read",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "led-red-2",
    "sequence": 92,
    "leftWord": "led",
    "rightWord": "red",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "lane-rain-2",
    "sequence": 93,
    "leftWord": "lane",
    "rightWord": "rain",
    "category": "longer-word",
    "difficulty": 3
  },
  {
    "id": "load-road-2",
    "sequence": 94,
    "leftWord": "load",
    "rightWord": "road",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "low-row-2",
    "sequence": 95,
    "leftWord": "low",
    "rightWord": "row",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "lock-rock-2",
    "sequence": 96,
    "leftWord": "lock",
    "rightWord": "rock",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "late-rate-2",
    "sequence": 97,
    "leftWord": "late",
    "rightWord": "rate",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "lace-race-2",
    "sequence": 98,
    "leftWord": "lace",
    "rightWord": "race",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "lamb-ram-2",
    "sequence": 99,
    "leftWord": "lamb",
    "rightWord": "ram",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "lamp-ramp-2",
    "sequence": 100,
    "leftWord": "lamp",
    "rightWord": "ramp",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "lake-rake-2",
    "sequence": 101,
    "leftWord": "lake",
    "rightWord": "rake",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "lip-rip-2",
    "sequence": 102,
    "leftWord": "lip",
    "rightWord": "rip",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "limb-rim-2",
    "sequence": 103,
    "leftWord": "limb",
    "rightWord": "rim",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "link-rink-2",
    "sequence": 104,
    "leftWord": "link",
    "rightWord": "rink",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "loot-root-2",
    "sequence": 105,
    "leftWord": "loot",
    "rightWord": "root",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "loom-room-2",
    "sequence": 106,
    "leftWord": "loom",
    "rightWord": "room",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "look-rook-2",
    "sequence": 107,
    "leftWord": "look",
    "rightWord": "rook",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "lush-rush-2",
    "sequence": 108,
    "leftWord": "lush",
    "rightWord": "rush",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "lust-rust-2",
    "sequence": 109,
    "leftWord": "lust",
    "rightWord": "rust",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "loyal-royal-1",
    "sequence": 110,
    "leftWord": "loyal",
    "rightWord": "royal",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "fly-fry-3",
    "sequence": 111,
    "leftWord": "fly",
    "rightWord": "fry",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "flea-free-2",
    "sequence": 112,
    "leftWord": "flea",
    "rightWord": "free",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "flame-frame-1",
    "sequence": 113,
    "leftWord": "flame",
    "rightWord": "frame",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "flesh-fresh-3",
    "sequence": 114,
    "leftWord": "flesh",
    "rightWord": "fresh",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "flight-fright-3",
    "sequence": 115,
    "leftWord": "flight",
    "rightWord": "fright",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "glass-grass-2",
    "sequence": 116,
    "leftWord": "glass",
    "rightWord": "grass",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "glow-grow-2",
    "sequence": 117,
    "leftWord": "glow",
    "rightWord": "grow",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "glue-grew-3",
    "sequence": 118,
    "leftWord": "glue",
    "rightWord": "grew",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "clam-cram-2",
    "sequence": 119,
    "leftWord": "clam",
    "rightWord": "cram",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "clash-crash-3",
    "sequence": 120,
    "leftWord": "clash",
    "rightWord": "crash",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "clown-crown-2",
    "sequence": 121,
    "leftWord": "clown",
    "rightWord": "crown",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "clue-crew-2",
    "sequence": 122,
    "leftWord": "clue",
    "rightWord": "crew",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "play-pray-3",
    "sequence": 123,
    "leftWord": "play",
    "rightWord": "pray",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "blade-braid-2",
    "sequence": 124,
    "leftWord": "blade",
    "rightWord": "braid",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "bloom-broom-2",
    "sequence": 125,
    "leftWord": "bloom",
    "rightWord": "broom",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "blush-brush-3",
    "sequence": 126,
    "leftWord": "blush",
    "rightWord": "brush",
    "category": "review",
    "difficulty": 2
  },
  {
    "id": "splint-sprint-2",
    "sequence": 127,
    "leftWord": "splint",
    "rightWord": "sprint",
    "category": "review",
    "difficulty": 2
  }
];
