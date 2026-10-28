import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";

type Player = { id: string; name: string; score: number; connected: boolean };
type Room = {
  code: string;
  hostId: string;
  players: Player[];
  bot: boolean;
  rounds: number;
  round: number;
  phase: "lobby" | "answering" | "reveal" | "finished";
  prompt?: string;
  answers: Record<string, string>;
  botAnswer?: string;
};
const prompts = [
  "____ BOARD",
  "CAMP ____",
  "PEANUT ____",
  "BIRTHDAY ____",
  "ICE ____",
  "SCHOOL ____",
  "RAIN ____",
  "STAR ____",
  "COFFEE ____",
  "BOOK ____",
];
const botChoices: Record<string, string[]> = {
  "____ BOARD": ["score", "skate", "surf"],
  "CAMP ____": ["fire", "ground", "site"],
  "PEANUT ____": ["butter", "gallery", "shell"],
  "BIRTHDAY ____": ["cake", "party", "wish"],
  "ICE ____": ["cream", "berg", "cube"],
  "SCHOOL ____": ["bus", "house", "yard"],
  "RAIN ____": ["bow", "drop", "coat"],
  "STAR ____": ["fish", "light", "dust"],
  "COFFEE ____": ["shop", "table", "bean"],
  "BOOK ____": ["case", "mark", "store"],
};
const rooms = new Map<string, Room>();
const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const code = () =>
  Array.from(
    { length: 4 },
    () => letters[Math.floor(Math.random() * letters.length)],
  ).join("");
const publicRoom = (room: Room) => ({
  ...room,
  answers:
    room.phase === "reveal" || room.phase === "finished"
      ? room.answers
      : Object.fromEntries(Object.keys(room.answers).map((id) => [id, "••••"])),
  submitted: Object.keys(room.answers).length,
});
const app = express();
app.use(cors());
app.get("/health", (_, res) => res.json({ ok: true }));
const http = createServer(app);
const io = new Server(http, { cors: { origin: "*" } });
const emit = (r: Room) => io.to(r.code).emit("room:update", publicRoom(r));
function find(socketId: string) {
  return [...rooms.values()].find((r) =>
    r.players.some((p) => p.id === socketId),
  );
}
function startRound(room: Room) {
  room.round++;
  room.phase = "answering";
  room.answers = {};
  room.botAnswer = undefined;
  room.prompt = prompts[Math.floor(Math.random() * prompts.length)];
  emit(room);
}
function score(room: Room) {
  const entries = Object.entries(room.answers);
  if (room.bot && room.botAnswer) entries.push(["BOT", room.botAnswer]);
  const groups = new Map<string, string[]>();
  for (const [id, answer] of entries) {
    const key = answer.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) || []), id]);
  }
  for (const ids of groups.values()) {
    const points = ids.length === 2 ? 3 : ids.length > 2 ? 1 : 0;
    for (const id of ids) {
      const p = room.players.find((p) => p.id === id);
      if (p) p.score += points;
    }
  }
  room.phase = "reveal";
  emit(room);
}
io.on("connection", (socket) => {
  socket.on("room:create", ({ name, rounds = 3, bot = false }, done) => {
    const clean = String(name || "")
      .trim()
      .slice(0, 20);
    if (!clean) return done({ error: "Enter a name." });
    let roomCode = code();
    while (rooms.has(roomCode)) roomCode = code();
    const room: Room = {
      code: roomCode,
      hostId: socket.id,
      players: [{ id: socket.id, name: clean, score: 0, connected: true }],
      bot: Boolean(bot),
      rounds: Math.min(10, Math.max(1, Number(rounds) || 3)),
      round: 0,
      phase: "lobby",
      answers: {},
    };
    rooms.set(roomCode, room);
    socket.join(roomCode);
    done({ room: publicRoom(room) });
  });
  socket.on("room:join", ({ name, code: raw }, done) => {
    const room = rooms.get(String(raw || "").toUpperCase());
    const clean = String(name || "")
      .trim()
      .slice(0, 20);
    if (!room) return done({ error: "Room not found." });
    if (room.phase !== "lobby")
      return done({ error: "This game has already started." });
    if (!clean) return done({ error: "Enter a name." });
    if (room.players.length >= 8) return done({ error: "This room is full." });
    room.players.push({
      id: socket.id,
      name: clean,
      score: 0,
      connected: true,
    });
    socket.join(room.code);
    emit(room);
    done({ room: publicRoom(room) });
  });
  socket.on("lobby:settings", ({ bot, rounds }, done) => {
    const room = find(socket.id);
    if (!room || room.hostId !== socket.id)
      return done?.({ error: "Host only." });
    if (room.phase !== "lobby") return;
    room.bot = Boolean(bot);
    room.rounds = Math.min(10, Math.max(1, Number(rounds) || 3));
    emit(room);
  });
  socket.on("game:start", (done) => {
    const room = find(socket.id);
    if (!room || room.hostId !== socket.id)
      return done?.({ error: "Host only." });
    if (room.players.length < 2)
      return done?.({ error: "At least 2 players are needed." });
    startRound(room);
  });
  socket.on("answer:submit", ({ answer }, done) => {
    const room = find(socket.id);
    const word = String(answer || "").trim();
    if (!room || room.phase !== "answering")
      return done?.({ error: "Answers are closed." });
    if (!word || /\s/.test(word))
      return done?.({ error: "Enter exactly one word." });
    room.answers[socket.id] = word.slice(0, 30);
    emit(room);
    if (Object.keys(room.answers).length === room.players.length) {
      if (room.bot)
        room.botAnswer = (botChoices[room.prompt!] || ["party"])[
          Math.floor(
            Math.random() * (botChoices[room.prompt!] || ["party"]).length,
          )
        ];
      score(room);
    }
  });
  socket.on("round:continue", (done) => {
    const room = find(socket.id);
    if (!room || room.hostId !== socket.id || room.phase !== "reveal")
      return done?.({ error: "Host only." });
    if (room.round >= room.rounds) {
      room.phase = "finished";
      emit(room);
    } else startRound(room);
  });
  socket.on("disconnect", () => {
    const room = find(socket.id);
    if (!room) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (player) player.connected = false;
    if (room.hostId === socket.id)
      room.hostId = room.players.find((p) => p.connected)?.id || socket.id;
    emit(room);
  });
});
http.listen(3001, () =>
  console.log("Game server listening on http://localhost:3001"),
);
