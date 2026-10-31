import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
type Mode = "chill" | "party";
type Modifier = "double" | "mirror" | "aiTrap" | "luckyPair" | "curse";
type Phase = "lobby" | "intro" | "answering" | "reveal" | "finished";
type Player = {
  id: string;
  name: string;
  score: number;
  likes: number;
  connected: boolean;
  isTest?: boolean;
};
type Prompt = { text: string; theme: string; answers: string[] };
type Room = {
  code: string;
  hostId: string;
  players: Player[];
  bot: boolean;
  rounds: number;
  round: number;
  phase: Phase;
  mode: Mode;
  modifiers: Modifier[];
  activeModifier?: Modifier;
  secondaryModifier?: Modifier;
  prompt?: Prompt;
  answers: Record<string, string>;
  botAnswer?: string;
  botStyle?: string;
  mirrorPlayerId?: string;
  mirrorTargetId?: string;
  cursedPlayerId?: string;
  usedPrompts: string[];
  roundLikes: Record<string, string>;
  testPlayers: number;
  revealOrder: string[];
  revealedCount: number;
  autoReveal: boolean;
  uniqueCounts: Record<string, number>;
  compatiblePairs: Record<string, number>;
};
const rows: [string, string, string[]][] = [
  ["____ BOARD", "Everyday", ["score", "skate", "surf"]],
  ["CAMP ____", "Outdoors", ["fire", "ground", "site"]],
  ["PEANUT ____", "Food", ["butter", "gallery", "shell"]],
  ["BIRTHDAY ____", "Celebration", ["cake", "party", "wish"]],
  ["ICE ____", "Everyday", ["cream", "berg", "cube"]],
  ["SCHOOL ____", "School", ["bus", "house", "yard"]],
  ["RAIN ____", "Weather", ["bow", "drop", "coat"]],
  ["STAR ____", "Space", ["fish", "light", "dust"]],
  ["COFFEE ____", "Food", ["shop", "table", "bean"]],
  ["BOOK ____", "Everyday", ["case", "mark", "store"]],
  ["____ LIGHT", "Everyday", ["traffic", "flash", "moon"]],
  ["MOVIE ____", "Entertainment", ["star", "night", "theater"]],
  ["ROAD ____", "Travel", ["trip", "house", "map"]],
  ["SWEET ____", "Food", ["tooth", "dreams", "spot"]],
  ["DREAM ____", "Everyday", ["catcher", "team", "land"]],
  ["PHONE ____", "Technology", ["call", "book", "case"]],
  ["FIRE ____", "Outdoors", ["fly", "place", "man"]],
  ["PIZZA ____", "Food", ["party", "place", "crust"]],
  ["SNOW ____", "Weather", ["man", "ball", "storm"]],
  ["BEACH ____", "Travel", ["ball", "house", "day"]],
  ["___ AND ___", "Phrase", ["cheese crackers", "chips dip", "shake bake"]],
  ["HIT THE ___", "Phrase", ["road", "books", "hay"]],
  ["KEEP IT ___", "Phrase", ["real", "simple", "cool"]],
  ["BETTER ___ THAN NEVER", "Phrase", ["late", "safe", "now"]],
  ["OUT OF ___", "Phrase", ["time", "mind", "touch"]],
  ["ON THE ___", "Phrase", ["road", "run", "house"]],
  ["A PIECE OF ___", "Phrase", ["cake", "mind", "work"]],
  ["BREAK THE ___", "Phrase", ["ice", "rules", "news"]],
  ["UNDER THE ___", "Phrase", ["weather", "sea", "table"]],
  ["GOOD ___", "Everyday", ["morning", "luck", "night"]],
  ["TACO ____", "Food", ["tuesday", "bell", "truck"]],
  ["GAME ____", "Entertainment", ["night", "over", "plan"]],
  ["SUMMER ____", "Travel", ["camp", "break", "time"]],
  ["____ DOG", "Everyday", ["hot", "watch", "house"]],
  ["SPACE ____", "Space", ["ship", "man", "station"]],
  ["MORNING ____", "Everyday", ["coffee", "show", "sun"]],
  ["SECRET ____", "Everyday", ["agent", "garden", "service"]],
  ["DANCE ____", "Entertainment", ["floor", "party", "move"]],
  ["FAMILY ____", "Everyday", ["tree", "guy", "time"]],
  ["MIDNIGHT ____", "Entertainment", ["snack", "train", "blue"]],
];
const extensions: [string, string, string[]][] = [
  ["MOON ____", "Space", ["light", "beam", "walk"]],
  ["SUN ____", "Space", ["shine", "set", "flower"]],
  ["WATER ____", "Everyday", ["fall", "melon", "proof"]],
  ["TIME ____", "Everyday", ["line", "zone", "piece"]],
  ["HOME ____", "Everyday", ["work", "run", "made"]],
  ["NEWS ____", "Everyday", ["paper", "room", "stand"]],
  ["TOOTH ____", "Everyday", ["brush", "paste", "pick"]],
  ["HAND ____", "Everyday", ["shake", "bag", "made"]],
  ["FOOT ____", "Everyday", ["ball", "print", "step"]],
  ["HEAD ____", "Everyday", ["phones", "light", "line"]],
  ["AIR ____", "Travel", ["plane", "port", "time"]],
  ["TRAIN ____", "Travel", ["track", "wreck", "station"]],
  ["SNACK ____", "Food", ["time", "bar", "cake"]],
  ["APPLE ____", "Food", ["pie", "sauce", "tree"]],
  ["CHEESE ____", "Food", ["cake", "burger", "board"]],
  ["CHOCOLATE ____", "Food", ["cake", "chip", "bar"]],
  ["POP ____", "Entertainment", ["corn", "star", "song"]],
  ["MUSIC ____", "Entertainment", ["video", "box", "store"]],
  ["SUPER ____", "Entertainment", ["hero", "star", "man"]],
  ["VIDEO ____", "Entertainment", ["game", "tape", "chat"]],
  ["NIGHT ____", "Everyday", ["mare", "life", "stand"]],
  ["DAY ____", "Everyday", ["dream", "light", "time"]],
  ["WORK ____", "Everyday", ["shop", "out", "place"]],
  ["MAIL ____", "Technology", ["box", "man", "room"]],
  ["WEB ____", "Technology", ["site", "cam", "page"]],
  ["BRAIN ____", "Everyday", ["storm", "wash", "child"]],
  ["SAND ____", "Outdoors", ["castle", "box", "storm"]],
  ["TREE ____", "Outdoors", ["house", "top", "line"]],
  ["WIND ____", "Weather", ["shield", "mill", "storm"]],
  ["THUNDER ____", "Weather", ["storm", "bolt", "cloud"]],
  ["BABY ____", "Everyday", ["sitter", "shower", "face"]],
  ["PET ____", "Everyday", ["shop", "name", "food"]],
  ["PARTY ____", "Celebration", ["time", "line", "game"]],
  ["GIFT ____", "Celebration", ["card", "shop", "wrap"]],
  ["FASHION ____", "Everyday", ["show", "week", "sense"]],
  ["FRIEND ____", "Everyday", ["ship", "zone", "group"]],
  ["LOVE ____", "Everyday", ["letter", "song", "bird"]],
  ["SILVER ____", "Everyday", ["ware", "lining", "star"]],
  ["GOLD ____", "Everyday", ["fish", "mine", "rush"]],
  ["BLACK ____", "Everyday", ["board", "out", "mail"]],
];
const generatedBases = [
  "ART",
  "BASKET",
  "BELL",
  "BIRD",
  "BLUE",
  "BOAT",
  "BREAD",
  "BRUSH",
  "CANDLE",
  "CARD",
  "CARPET",
  "CASH",
  "CLOUD",
  "COAT",
  "CORN",
  "CROSS",
  "CROWN",
  "DOLL",
  "DOOR",
  "DRAGON",
  "DROP",
  "EAR",
  "EARTH",
  "EYE",
  "FACE",
  "FARM",
  "FEATHER",
  "FIELD",
  "FINGER",
  "FLAG",
  "FLOWER",
  "FOOD",
  "FOX",
  "FRAME",
  "GARDEN",
  "GLASS",
  "GRASS",
  "GUITAR",
  "HAIR",
  "HAMMER",
  "HEART",
  "HILL",
  "HORSE",
  "HOUSE",
  "JELLY",
  "KEY",
  "KING",
  "KITE",
  "LAKE",
  "LEAF",
  "LION",
  "LOCK",
  "LUNCH",
  "MAP",
  "MILK",
  "MONEY",
  "MONSTER",
  "MOUSE",
  "NAIL",
  "NAME",
  "OCEAN",
  "PAINT",
  "PAPER",
  "PARK",
  "PEN",
  "PENCIL",
  "PILLOW",
  "PINE",
  "PLANE",
  "PLANT",
  "RING",
  "ROCK",
  "ROSE",
  "SCHOOL",
  "SEA",
  "SHEEP",
  "SHOE",
  "SHIP",
  "SHIRT",
  "SKY",
  "SNAKE",
  "SOCK",
  "SOUND",
  "SPOON",
  "SPRING",
  "STICK",
  "STONE",
  "STORM",
  "STREET",
  "SUGAR",
  "TABLE",
  "TIGER",
  "TOY",
  "TRUCK",
  "WALL",
  "WATCH",
  "WAVE",
  "WHEEL",
  "WINDOW",
  "WOLF",
  "WOOD",
  "WORD",
];
const generated: [string, string, string[]][] = generatedBases.map(
  (base, index) => [
    `${base} ____`,
    "Everyday",
    [
      [
        "house",
        "light",
        "work",
        "time",
        "book",
        "ball",
        "line",
        "box",
        "man",
        "land",
      ][index % 10],
      [
        "room",
        "side",
        "way",
        "case",
        "ware",
        "ship",
        "mate",
        "fall",
        "proof",
        "star",
      ][(index + 3) % 10],
      [
        "bird",
        "fish",
        "mark",
        "stone",
        "drop",
        "fall",
        "place",
        "board",
        "stand",
        "fire",
      ][(index + 6) % 10],
    ],
  ],
);
const prompts: Prompt[] = [
  ...rows.filter(([, theme]) => theme !== "Phrase"),
  ...extensions,
  ...generated,
].map(([text, theme, answers]) => ({ text, theme, answers }));
const labels: Record<Modifier, string> = {
  double: "Double Down",
  mirror: "Mirror Move",
  aiTrap: "AI Trap",
  luckyPair: "Lucky Pair",
  curse: "Curse",
};
const all: Modifier[] = ["double", "mirror", "aiTrap", "luckyPair", "curse"];
const rooms = new Map<string, Room>();
const pick = <T>(x: readonly T[]) => x[Math.floor(Math.random() * x.length)];
const makeCode = () =>
  Array.from({ length: 4 }, () =>
    pick("ABCDEFGHJKLMNPQRSTUVWXYZ".split("")),
  ).join("");
const app = express();
app.use(cors());
app.get("/health", (_, res) => res.json({ ok: true }));
const http = createServer(app);
const io = new Server(http, { cors: { origin: "*" } });
const find = (id: string) =>
  [...rooms.values()].find((r) => r.players.some((p) => p.id === id));
function publicRoom(r: Room, viewerId?: string) {
  const curseVisible =
    r.phase === "reveal" ||
    r.phase === "finished" ||
    viewerId === r.cursedPlayerId;
  const playerById = (id: string) => r.players.find((p) => p.id === id);
  const uniqueStats = Object.entries(r.uniqueCounts)
    .map(([id, count]) => ({
      id,
      name: playerById(id)?.name || "Player",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const compatibleStats = Object.entries(r.compatiblePairs)
    .map(([key, count]) => {
      const [a, b] = key.split("|");
      return {
        ids: [a, b],
        names: [
          playerById(a)?.name || "Player",
          playerById(b)?.name || "Player",
        ],
        count,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  return {
    ...r,
    prompt: r.prompt?.text,
    promptTheme: r.prompt?.theme,
    activeModifierLabel: r.activeModifier
      ? labels[r.activeModifier]
      : undefined,
    cursedPlayerId: curseVisible ? r.cursedPlayerId : undefined,
    answers:
      r.phase === "reveal" || r.phase === "finished"
        ? r.answers
        : Object.fromEntries(Object.keys(r.answers).map((id) => [id, "••••"])),
    submitted: Object.keys(r.answers).length,
    mirrorTargetId: r.phase === "reveal" ? r.mirrorTargetId : undefined,
    uniqueStats,
    compatibleStats,
  };
}
const emit = (r: Room) => {
  for (const player of r.players)
    if (!player.isTest)
      io.to(player.id).emit("room:update", publicRoom(r, player.id));
};
const has = (r: Room, modifier: Modifier) =>
  r.activeModifier === modifier || r.secondaryModifier === modifier;
function startRound(r: Room) {
  r.round++;
  r.phase = "intro";
  r.answers = {};
  r.roundLikes = {};
  r.revealOrder = [];
  r.revealedCount = 0;
  r.autoReveal = false;
  r.botAnswer = undefined;
  r.botStyle = undefined;
  r.mirrorTargetId = undefined;
  r.mirrorPlayerId = undefined;
  r.cursedPlayerId = undefined;
  r.secondaryModifier = undefined;
  const lastTwo = r.mode === "party" && r.round > r.rounds - 2;
  const eligible = r.modifiers.filter((m) => m !== "double");
  r.activeModifier =
    r.round === 1
      ? undefined
      : r.mode === "party"
        ? pick(eligible.length ? eligible : r.modifiers)
        : undefined;
  if (lastTwo && r.activeModifier) r.secondaryModifier = "double";
  const unused = prompts.filter((p) => !r.usedPrompts.includes(p.text));
  if (!unused.length) r.usedPrompts = [];
  const deck = unused.length ? unused : prompts;
  r.prompt = pick(deck);
  r.usedPrompts.push(r.prompt.text);
  const humans = r.players.filter((p) => !p.isTest);
  if (has(r, "mirror")) r.mirrorPlayerId = pick(humans).id;
  if (has(r, "curse")) r.cursedPlayerId = pick(humans).id;
  emit(r);
  setTimeout(
    () => {
      if (r.phase === "intro") {
        r.phase = "answering";
        emit(r);
      }
    },
    r.activeModifier ? 2600 : 1300,
  );
}
function score(r: Room) {
  if (has(r, "mirror") && r.mirrorPlayerId && r.mirrorTargetId)
    r.answers[r.mirrorPlayerId] = r.answers[r.mirrorTargetId];
  const useBot = r.bot || has(r, "aiTrap");
  if (useBot && r.prompt) {
    const styles = [
      ["The Obvious One", 0],
      ["The Clever One", 1],
      ["The Chaos Goblin", Math.floor(Math.random() * r.prompt.answers.length)],
    ] as const;
    const style = has(r, "aiTrap") ? styles[0] : pick(styles);
    r.botStyle = style[0];
    r.botAnswer =
      r.prompt.answers[Math.min(style[1], r.prompt.answers.length - 1)];
  }
  const entries = Object.entries(r.answers);
  if (useBot && r.botAnswer) entries.push(["BOT", r.botAnswer]);
  const groups = new Map<string, string[]>();
  for (const [id, a] of entries) {
    const key = a.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) || []), id]);
  }
  r.revealOrder = [...groups.keys()].sort(() => Math.random() - 0.5);
  const playerCount = r.players.length + (useBot ? 1 : 0);
  for (const ids of groups.values()) {
    const humans = ids.filter((id) => id !== "BOT");
    if (humans.length === 1)
      r.uniqueCounts[humans[0]] = (r.uniqueCounts[humans[0]] || 0) + 1;
    if (humans.length === 2) {
      const key = [...humans].sort().join("|");
      r.compatiblePairs[key] = (r.compatiblePairs[key] || 0) + 1;
    }
    const trap = has(r, "aiTrap") && ids.includes("BOT");
    if (trap) continue;
    const cursed =
      has(r, "curse") && r.cursedPlayerId && ids.includes(r.cursedPlayerId);
    if (cursed) {
      const cursedPlayer = r.players.find((p) => p.id === r.cursedPlayerId);
      const victims = ids.filter(
        (id) => id !== r.cursedPlayerId && id !== "BOT",
      );
      if (cursedPlayer && victims.length)
        cursedPlayer.score += victims.length * 2;
      for (const id of victims) {
        const p = r.players.find((p) => p.id === id);
        if (p) p.score = Math.max(0, p.score - 1);
      }
      continue;
    }
    const base =
      ids.length === 2
        ? has(r, "luckyPair")
          ? 5
          : 3
        : ids.length === 3 && playerCount >= 4
          ? 1
          : 0;
    const points = base * (has(r, "double") ? 2 : 1);
    for (const id of ids) {
      const p = r.players.find((p) => p.id === id);
      if (p) p.score += points;
    }
  }
  r.phase = "reveal";
  emit(r);
}
const mods = (x: unknown): Modifier[] =>
  Array.isArray(x)
    ? x.filter((m): m is Modifier => all.includes(m as Modifier))
    : all;
io.on("connection", (s) => {
  s.on("room:create", ({ name, bot = true }, done) => {
    const n = String(name || "")
      .trim()
      .slice(0, 20);
    if (!n) return done({ error: "Enter a name." });
    let code = makeCode();
    while (rooms.has(code)) code = makeCode();
    const r: Room = {
      code,
      hostId: s.id,
      players: [{ id: s.id, name: n, score: 0, likes: 0, connected: true }],
      bot: Boolean(bot),
      rounds: 5,
      round: 0,
      phase: "lobby",
      mode: "chill",
      modifiers: all,
      answers: {},
      usedPrompts: [],
      roundLikes: {},
      testPlayers: 0,
      revealOrder: [],
      revealedCount: 0,
      autoReveal: false,
      uniqueCounts: {},
      compatiblePairs: {},
    };
    rooms.set(code, r);
    s.join(code);
    done({ room: publicRoom(r, s.id) });
  });
  s.on("room:join", ({ name, code }, done) => {
    const r = rooms.get(String(code || "").toUpperCase()),
      n = String(name || "")
        .trim()
        .slice(0, 20);
    if (!r) return done({ error: "Room not found." });
    if (r.phase !== "lobby")
      return done({ error: "This game has already started." });
    if (!n) return done({ error: "Enter a name." });
    if (r.players.length >= 8) return done({ error: "This room is full." });
    r.players.push({ id: s.id, name: n, score: 0, likes: 0, connected: true });
    s.join(r.code);
    emit(r);
    done({ room: publicRoom(r) });
  });
  s.on(
    "lobby:settings",
    ({ bot, rounds, mode, modifiers, testPlayers }, done) => {
      const r = find(s.id);
      if (!r || r.hostId !== s.id) return done?.({ error: "Host only." });
      if (r.phase !== "lobby") return;
      r.bot = Boolean(bot);
      r.rounds = Math.min(20, Math.max(5, Number(rounds) || 5));
      r.mode = mode === "party" ? "party" : "chill";
      r.modifiers = mods(modifiers);
      if (Number.isInteger(testPlayers)) {
        r.testPlayers = Math.max(
          0,
          Math.min(
            8 - r.players.filter((p) => !p.isTest).length,
            Number(testPlayers),
          ),
        );
        r.players = r.players.filter((p) => !p.isTest);
        for (let i = 1; i <= r.testPlayers; i++)
          r.players.push({
            id: `TEST-${i}`,
            name: `Practice Player ${i}`,
            score: 0,
            likes: 0,
            connected: true,
            isTest: true,
          });
      }
      emit(r);
    },
  );
  s.on("game:start", (done) => {
    const r = find(s.id);
    if (!r || r.hostId !== s.id) return done?.({ error: "Host only." });
    if (r.players.length < 2)
      return done?.({ error: "At least 2 players are needed." });
    if (r.mode === "party" && !r.modifiers.length)
      return done?.({ error: "Choose at least one Party Mode modifier." });
    startRound(r);
  });
  s.on("answer:submit", ({ answer, mirrorTargetId }, done) => {
    const r = find(s.id);
    const a = String(answer || "")
      .trim()
      .replace(/\s+/g, " ");
    if (!r || r.phase !== "answering")
      return done?.({ error: "Answers are closed." });
    const canMirror =
      has(r, "mirror") &&
      r.mirrorPlayerId === s.id &&
      r.players.some((p) => p.id === mirrorTargetId) &&
      mirrorTargetId !== s.id;
    if (canMirror) {
      r.mirrorTargetId = mirrorTargetId;
      r.answers[s.id] = "MIRROR";
    } else {
      if (
        !/^[A-Za-z][A-Za-z'-]*(?:\s+(?:&\s+)?[A-Za-z][A-Za-z'-]*){0,3}$/.test(a)
      )
        return done?.({
          error: "Enter up to four words, at least 2 letters each.",
        });
      r.answers[s.id] = a;
    }
    const real = r.players.filter((p) => !p.isTest);
    if (Object.keys(r.answers).length === real.length) {
      for (const p of r.players.filter((p) => p.isTest)) {
        const choices = r.prompt?.answers || ["party"];
        r.answers[p.id] = pick(choices);
      }
      score(r);
    } else emit(r);
  });
  s.on("reveal:one", (done) => {
    const r = find(s.id);
    if (!r || r.hostId !== s.id || r.phase !== "reveal")
      return done?.({ error: "Host only." });
    r.revealedCount = Math.min(r.revealedCount + 1, r.revealOrder.length);
    emit(r);
  });
  s.on("reveal:all", (done) => {
    const r = find(s.id);
    if (!r || r.hostId !== s.id || r.phase !== "reveal")
      return done?.({ error: "Host only." });
    if (r.autoReveal) return;
    r.autoReveal = true;
    const revealNext = () => {
      if (r.phase !== "reveal" || !r.autoReveal) return;
      r.revealedCount = Math.min(r.revealedCount + 1, r.revealOrder.length);
      emit(r);
      if (r.revealedCount < r.revealOrder.length) setTimeout(revealNext, 1200);
    };
    revealNext();
  });
  s.on("answer:like", ({ playerId }, done) => {
    const r = find(s.id);
    if (!r || r.phase !== "reveal")
      return done?.({ error: "Likes open after the reveal." });
    if (r.roundLikes[s.id])
      return done?.({ error: "You already used your like this round." });
    if (playerId === s.id || !r.players.some((p) => p.id === playerId))
      return done?.({ error: "Choose another player." });
    r.roundLikes[s.id] = playerId;
    const p = r.players.find((p) => p.id === playerId);
    if (p) p.likes++;
    emit(r);
  });
  s.on("round:continue", (done) => {
    const r = find(s.id);
    if (!r || r.hostId !== s.id || r.phase !== "reveal")
      return done?.({ error: "Host only." });
    if (r.round >= r.rounds) {
      r.phase = "finished";
      emit(r);
    } else startRound(r);
  });
  s.on("game:new", (done) => {
    const r = find(s.id);
    if (!r || r.hostId !== s.id || r.phase !== "finished")
      return done?.({ error: "Host only." });
    r.players.forEach((p) => {
      p.score = 0;
      p.likes = 0;
    });
    r.round = 0;
    r.phase = "lobby";
    r.answers = {};
    r.usedPrompts = [];
    r.roundLikes = {};
    r.uniqueCounts = {};
    r.compatiblePairs = {};
    r.activeModifier = undefined;
    emit(r);
  });
  s.on("room:leave", () => {
    const r = find(s.id);
    if (!r) return;
    s.leave(r.code);
    r.players = r.players.filter((p) => p.id !== s.id);
    if (!r.players.length) rooms.delete(r.code);
    else {
      if (r.hostId === s.id) r.hostId = r.players[0].id;
      emit(r);
    }
  });
  s.on("disconnect", () => {
    const r = find(s.id);
    if (!r) return;
    const p = r.players.find((p) => p.id === s.id);
    if (p) p.connected = false;
    if (r.hostId === s.id)
      r.hostId = r.players.find((p) => p.connected)?.id || s.id;
    emit(r);
  });
});
http.listen(process.env.PORT || 3001, () =>
  console.log('Game server running')
);
