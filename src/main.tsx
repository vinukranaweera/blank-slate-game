import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { io, Socket } from "socket.io-client";
import { AnimatePresence, motion } from "framer-motion";
import "./styles.css";

type Mode = "chill" | "party";
type Modifier = "double" | "mirror" | "aiTrap" | "luckyPair" | "curse";
type Player = {
  id: string;
  name: string;
  score: number;
  likes: number;
  isTest?: boolean;
};
type Stat = { id: string; name: string; count: number };
type PairStat = { ids: string[]; names: string[]; count: number };
type Room = {
  code: string;
  hostId: string;
  players: Player[];
  bot: boolean;
  rounds: number;
  round: number;
  phase: "lobby" | "intro" | "answering" | "reveal" | "finished";
  mode: Mode;
  modifiers: Modifier[];
  activeModifier?: Modifier;
  secondaryModifier?: Modifier;
  prompt?: string;
  promptTheme?: string;
  answers: Record<string, string>;
  botAnswer?: string;
  mirrorPlayerId?: string;
  cursedPlayerId?: string;
  roundLikes: Record<string, string>;
  submitted: number;
  testPlayers: number;
  revealOrder: string[];
  revealedCount: number;
  autoReveal: boolean;
  uniqueStats: Stat[];
  compatibleStats: PairStat[];
};
type Reveal = { answer: string; players: Player[]; bot?: boolean };
const socket: Socket = io(
  import.meta.env.VITE_SOCKET_URL ??
    `${window.location.protocol}//${window.location.hostname}:3001`
);
const info: Record<Modifier, [string, string, string]> = {
  double: ["✦", "Double Down", "All points are doubled."],
  mirror: [
    "↔",
    "Mirror Move",
    "A random player can secretly copy another player’s answer.",
  ],
  aiTrap: ["⚠", "AI Trap", "If anyone matches the Trap’s answer, no one scores points."],
  luckyPair: ["♥", "Lucky Pair", "Pairs earn 5 points instead of 3."],
  curse: ["☾", "Curse", "A secret player has been cursed. Match the cursed player: you lose 1 point, they gain 2."],
};

function App() {
  const [room, setRoom] = useState<Room | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [answer, setAnswer] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [revealCount, setRevealCount] = useState(0);
  const [finalCount, setFinalCount] = useState(0);
  const host = room?.hostId === socket.id;
  const mirror = Boolean(
    room &&
    (room.activeModifier === "mirror" || room.secondaryModifier === "mirror") &&
    room.mirrorPlayerId === socket.id,
  );
  const activeMods = room
    ? [room.activeModifier, room.secondaryModifier].filter((m): m is Modifier =>
        Boolean(m),
      )
    : [];
  useEffect(() => {
    const selector = 'meta[name="viewport"]';
    let viewport = document.querySelector<HTMLMetaElement>(selector);
    if (!viewport) {
      viewport = document.createElement("meta");
      viewport.name = "viewport";
      document.head.append(viewport);
    }
    viewport.content =
      "width=device-width, initial-scale=1, viewport-fit=cover";
  }, []);
  useEffect(() => {
    socket.on("room:update", setRoom);
    return () => {
      socket.off("room:update", setRoom);
    };
  }, []);
  const call = (event: string, data?: object) => {
    setError("");
    socket.emit(event, data, (r: { room?: Room; error?: string } = {}) => {
      setError(r.error || "");
      if (r.room) setRoom(r.room);
    });
  };
  const settings = (x: object) =>
    room &&
    call("lobby:settings", {
      bot: room.bot,
      rounds: room.rounds,
      mode: room.mode,
      modifiers: room.modifiers,
      testPlayers: room.testPlayers,
      ...x,
    });
  const leave = () => {
    socket.emit("room:leave");
    setRoom(null);
    setError("");
  };
  const reveals = useMemo<Reveal[]>(() => {
    if (!room || room.phase !== "reveal") return [];
    const groups = new Map<string, Reveal>();
    for (const p of room.players) {
      const answer = room.answers[p.id];
      const key = answer?.trim().toLowerCase() || p.id;
      const group = groups.get(key);
      if (group) group.players.push(p);
      else groups.set(key, { answer, players: [p] });
    }
    if ((room.bot || activeMods.includes("aiTrap")) && room.botAnswer) {
      const key = room.botAnswer.toLowerCase();
      const group = groups.get(key);
      if (group) group.bot = true;
      else groups.set(key, { answer: room.botAnswer, players: [], bot: true });
    }
    return room.revealOrder
      .map((key) => groups.get(key))
      .filter((group): group is Reveal => Boolean(group));
  }, [room, activeMods]);
  useEffect(() => {
    setRevealCount(room?.revealedCount || 0);
  }, [room?.revealedCount]);
  useEffect(() => {
    if (room?.phase !== "finished") {
      setFinalCount(0);
      return;
    }
    const total = room.players.length;
    let count = 0;
    let timer = 0;
    const next = () => {
      count++;
      setFinalCount(count);
      if (count < total)
        timer = window.setTimeout(next, count < total - 3 ? 550 : 1100);
    };
    timer = window.setTimeout(next, 500);
    return () => window.clearTimeout(timer);
  }, [room?.phase, room?.players.length]);
  if (!room)
    return (
      <Menu
        name={name}
        setName={setName}
        code={code}
        setCode={setCode}
        error={error}
        create={() => call("room:create", { name })}
        join={() => call("room:join", { name, code })}
      />
    );
  const scores = [...room.players].sort((a, b) => b.score - a.score);
  const likes = [...room.players].sort((a, b) => b.likes - a.likes);
  const winners = scores.filter((p) => p.score === scores[0]?.score);
  return (
    <main className={`app-shell phase-${room.phase}`}>
      <header>
        <div className="logo">
          BLANK <i>SLATE</i>
        </div>
        <div className="header-meta">
          <span className="roomcode">
            ROOM CODE: <b>{room.code}</b>
          </span>
          {room.phase !== "lobby" && room.phase !== "finished" 
        //   && (
        //     <span className="header-round">
        //       ROUND {room.round} OF {room.rounds}
        //     </span>
        //   )
          }
        </div>
      </header>
      {room.phase === "lobby" && (
        <Lobby
          room={room}
          host={Boolean(host)}
          settings={settings}
          start={() => call("game:start")}
          error={error}
        />
      )}
      {room.phase === "intro" && (
        <section className="card game round-intro">
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring" }}
          >
            <Round room={room} />
            {activeMods.length ? (
              <ModifierBadges modifiers={activeMods} />
            ) : (
              <div className="no-modifier">LOADING NEXT WORD…</div>
            )}
            {activeMods.includes("curse") ? (
              <CurseMessage room={room} />
            ) : (
              <p>
                {activeMods.length
                  ? "A twist is coming. Get ready."
                  : "Get ready to match minds."}
              </p>
            )}
          </motion.div>
        </section>
      )}
      {room.phase === "answering" && (
        <section className="card game gameplay-card">
          <Round room={room} />
          {activeMods.length > 0 && <ModifierBadges modifiers={activeMods} />}
          <Cue room={room} />
          {activeMods.includes("curse") && <CurseMessage room={room} />}
          <p>
            {mirror
              ? "You can copy another player’s answer. Click on their name, then lock in."
              : "Enter up to four words—at least two letters each."}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              call("answer:submit", { answer, mirrorTargetId: target });
            }}
          >
            <input
              autoFocus
              disabled={Boolean(room.answers[socket.id || ""])}
              inputMode="text"
              autoCapitalize="words"
              value={answer}
              maxLength={80}
              onChange={(e) => {
                setTarget("");
                setAnswer(e.target.value);
              }}
              placeholder="e.g. rock & roll"
            />
            <button disabled={Boolean(room.answers[socket.id || ""])}>
              Lock it in
            </button>
          </form>
          <div className={`submission-list ${mirror ? "mirror-options" : ""}`}>
            {room.players.map((p, index) => {
              const done = Boolean(room.answers[p.id]);
              const selectable = mirror && p.id !== socket.id;
              return (
                <motion.button
                  type="button"
                  onClick={() =>
                    selectable && setTarget(target === p.id ? "" : p.id)
                  }
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className={`submit-banner player-color-${index % 8} ${done ? "submitted" : ""} ${target === p.id ? "mirror-selected" : ""} ${selectable ? "mirror-selectable" : ""}`}
                  key={p.id}
                >
                  <span>{p.name}</span>
                  <b>
                    {target === p.id
                      ? "COPYING"
                      : done
                        ? "LOCKED"
                        : "THINKING…"}
                  </b>
                </motion.button>
              );
            })}
          </div>
          {error && <p className="error">{error}</p>}
        </section>
      )}
      {room.phase === "reveal" && (
        <section className="card game">
          <Round room={room} />
          {activeMods.length > 0 && <ModifierBadges modifiers={activeMods} />}
          <Cue room={room} />
          <div className="reveal-stage">
            <AnimatePresence mode="popLayout">
              {reveals.slice(0, revealCount).map((group, i) => (
                <motion.div
                  key={`${group.answer}-${i}`}
                  className={`reveal-card ${activeMods.includes("aiTrap") && group.bot ? "trap-reveal" : ""} ${activeMods.includes("curse") && group.players.some((p) => p.id === room.cursedPlayerId) ? "curse-reveal" : ""}`}
                  initial={{ opacity: 0, y: -34, scale: 0.86 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 19 }}
                >
                  <strong>{group.answer}</strong>
                  <div className="reveal-owners">
                    {group.players.map((p, playerIndex) => {
                      const index = room.players.findIndex(
                        (x) => x.id === p.id,
                      );
                      const note =
                        activeMods.includes("mirror") &&
                        p.id === room.mirrorPlayerId
                          ? "↔"
                          : activeMods.includes("curse") &&
                              p.id === room.cursedPlayerId
                            ? "☾"
                            : "";
                      return (
                        <motion.span
                          initial={{ opacity: 0, x: -18 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.28 + playerIndex * 0.42 }}
                          className={`player-color-${index % 8}`}
                          key={p.id}
                        >
                          {p.name}
                          {note && <sup className="player-note">{note}</sup>}
                        </motion.span>
                      );
                    })}
                    {group.bot && (
                      <motion.span
                        initial={{ opacity: 0, x: -18 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.28 + group.players.length * 0.42,
                        }}
                        className="ai-owner"
                      >
                        ✦ AI
                      </motion.span>
                    )}
                  </div>
                  <Outcome
                    room={room}
                    group={group}
                    delay={
                      0.4 + (group.players.length + (group.bot ? 1 : 0)) * 0.42
                    }
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {revealCount < reveals.length && (
            <RevealControls
              host={Boolean(host)}
              started={revealCount > 0}
              auto={room.autoReveal}
              onOne={() => call("reveal:one")}
              onAll={() => call("reveal:all")}
            />
          )}{" "}
          {revealCount >= reveals.length && (
            <>
              <LikePanel
                room={room}
                onLike={(playerId) => call("answer:like", { playerId })}
              />
              <Score players={scores} />
              {host ? (
                <button onClick={() => call("round:continue")}>
                  {room.round === room.rounds
                    ? "See final leaderboard"
                    : "Next round"}
                </button>
              ) : (
                <p className="waiting">Waiting for host…</p>
              )}
            </>
          )}
        </section>
      )}
      {room.phase === "finished" && (
        <section className="card game leaderboard">
          <div className="round-counter">
            <span>GAME</span>
            <b>COMPLETE</b>
          </div>
          <h1>
            {finalCount >= scores.length
              ? winners.length > 1
                ? `${winners.map((p) => p.name).join(" & ")} tie!`
                : `${scores[0]?.name} wins!`
              : "Final standings"}
          </h1>
          <Podium players={scores} count={finalCount} />
          {finalCount >= scores.length && (
            <>
              <div className="final-stats">
                <Stats
                  title="♥ Most liked"
                  items={likes
                    .slice(0, 5)
                    .map((p) => ({ label: p.name, value: `♥ ${p.likes}` }))}
                />
                <Stats
                  title="✦ Most unique"
                  items={(room.uniqueStats || []).map((p) => ({
                    label: p.name,
                    value: `${p.count} unique`,
                  }))}
                />
                <Stats
                  title="↔ Most compatible"
                  items={(room.compatibleStats || []).map((p) => ({
                    label: p.names.join(" + "),
                    value: `${p.count} matches`,
                  }))}
                />
              </div>
              {host && (
                <button onClick={() => call("game:new")}>New game</button>
              )}
              <button className="secondary" onClick={leave}>
                Back to menu
              </button>
            </>
          )}
        </section>
      )}
    </main>
  );
}
function Menu({
  name,
  setName,
  code,
  setCode,
  error,
  create,
  join,
}: {
  name: string;
  setName: (v: string) => void;
  code: string;
  setCode: (v: string) => void;
  error: string;
  create: () => void;
  join: () => void;
}) {
  return (
    <main className="app-shell menu-shell">
      <header>
        <div className="logo">
          BLANK <i>SLATE</i>
        </div>
        <div className="menu-header-copy">THE GAME OF CLEVER CLUES</div>
      </header>
      <p className="author">
        A Multiplayer Party Game · Handshake AI Skills Studio × OpenAI
      </p>
      <section className="card welcome">
        <div className="menu-doodle" aria-hidden="true">
          ☻<span>✎</span>
        </div>
        <h1>The game of clever clues</h1>
        <div className="how-to">
          <h2>How to play</h2>
          <ol>
            <li>Read the word cue.</li>
            <li>Secretly write an answer.</li>
            <li>Match other players to score points.</li>
            <li>The most points wins!</li>
          </ol>
        </div>
        <label>
          Your display name
          <input
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Player1"
          />
        </label>
        <label>
          Enter 4-letter room code
          <input
            value={code}
            maxLength={4}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABCD"
          />
        </label>
        <div className="menu-actions">
          <button className="create-button" onClick={create}>
            🍏 Create game
          </button>
          <button className="secondary join-button" onClick={join}>
            🧽 Join game
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}
function Lobby({
  room,
  host,
  settings,
  start,
  error,
}: {
  room: Room;
  host: boolean;
  settings: (x: object) => void;
  start: () => void;
  error: string;
}) {
  return (
    <section className="card lobby-card">
      <h1>Lobby</h1>
      <p className="lobby-subtitle">
        Share room code <strong>{room.code}</strong> · {room.players.length}/8
        players
      </p>
      <div className="players">
        {room.players.map((p) => (
          <span key={p.id}>
            {p.name}
            {p.id === room.hostId ? " ★" : ""}
          </span>
        ))}
      </div>
      {host && (
        <>
          <div className="lobby-settings">
            <div className="mode-picker">
              <button
                className={room.mode === "chill" ? "selected" : ""}
                onClick={() => settings({ mode: "chill" })}
              >
                <b>Chill Mode</b>
                <small>Simple matching. No surprises.</small>
              </button>
              <button
                className={room.mode === "party" ? "selected" : ""}
                onClick={() => settings({ mode: "party" })}
              >
                <b>Party Mode</b>
                <small>One twist per round. Final two double.</small>
              </button>
            </div>
            {room.mode === "party" && (
              <div className="modifier-list">
                <b>Choose your twists</b>
                {(Object.keys(info) as Modifier[]).map((m) => {
                  const selected = room.modifiers.includes(m);
                  return (
                    <label
                      className={`modifier modifier-${m} ${selected ? "selected" : ""}`}
                      key={m}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) =>
                          settings({
                            modifiers: e.target.checked
                              ? [...room.modifiers, m]
                              : room.modifiers.filter((x) => x !== m),
                          })
                        }
                      />
                      <span className="modifier-choice-icon">{info[m][0]}</span>
                      <span>
                        <strong>{info[m][1]}</strong>
                        <small>{info[m][2]}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <label className="switch">
              <input
                type="checkbox"
                checked={room.bot}
                onChange={(e) => settings({ bot: e.target.checked })}
              />{" "}
              AI Wildcard Bot{" "}
              <small>adds a hidden personality-driven answer</small>
            </label>
            <label>
              Rounds
              <select
                value={room.rounds}
                onChange={(e) => settings({ rounds: +e.target.value })}
              >
                {[5, 10, 15, 20].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            {/* <label className="test-seats">
              Practice players
              <select
                value={room.testPlayers}
                onChange={(e) => settings({ testPlayers: +e.target.value })}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option
                    key={n}
                    disabled={
                      n > 8 - room.players.filter((p) => !p.isTest).length
                    }
                  >
                    {n}
                  </option>
                ))}
              </select>
              <small>
                Add automatic local players for testing. They are clearly
                labeled.
              </small>
            </label> */}
          </div>
          <button className="start-game" onClick={start}>
            🍎 Start game
          </button>
        </>
      )}
      {!host && <p className="waiting">Waiting for the host to start…</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
function Round({ room }: { room: Room }) {
  return (
    <div className="round-counter">
      <span>ROUND</span>
      <b>
        {room.round} / {room.rounds}
      </b>
    </div>
  );
}
function Cue({ room }: { room: Room }) {
  return <h2>{room.prompt}</h2>;
}
function ModifierBadges({ modifiers }: { modifiers: Modifier[] }) {
  return (
    <div className="modifier-row">
      {modifiers.map((m) => (
        <div className={`modifier-badge mod-${m}`} key={m}>
          <div className="modifier-symbol">{info[m][0]}</div>
          <b>{info[m][1]}</b>
          <span>{info[m][2]}</span>
        </div>
      ))}
    </div>
  );
}
function CurseMessage({ room }: { room: Room }) {
  const cursed = room.cursedPlayerId === socket.id;
  return (
    <p className="curse-notice">
      ☾{" "}
      {cursed
        ? "You have been cursed. You will earn 2 points for every person you match with."
        : "A random player has been cursed. You will earn 0 points if you match with them."}
    </p>
  );
}
function RevealControls({
  host,
  started,
  auto,
  onOne,
  onAll,
}: {
  host: boolean;
  started: boolean;
  auto: boolean;
  onOne: () => void;
  onAll: () => void;
}) {
  if (auto) return <p className="waiting">Revealing the remaining words…</p>;
  if (!host)
    return (
      <p className="waiting">The host is choosing how to reveal the answers…</p>
    );
  return (
    <div className="reveal-controls">
      <b>{started ? "Choose the next reveal" : "Choose the reveal"}</b>
      <div>
        <button onClick={onOne}>
          {started ? "Reveal next word" : "Reveal word"}
        </button>
        <button className="secondary" onClick={onAll}>
          {started ? "Reveal all remaining words" : "Reveal all words"}
        </button>
      </div>
    </div>
  );
}
function Outcome({
  room,
  group,
  delay,
}: {
  room: Room;
  group: Reveal;
  delay: number;
}) {
  const has = (m: Modifier) =>
    room.activeModifier === m || room.secondaryModifier === m;
  const count = group.players.length + (group.bot ? 1 : 0);
  const cursed =
    has("curse") && group.players.some((p) => p.id === room.cursedPlayerId);
  const trap = has("aiTrap") && group.bot;
  const total = room.players.length + (room.bot || has("aiTrap") ? 1 : 0);
  const points = trap
    ? 0
    : count === 2
      ? (has("luckyPair") ? 5 : 3) * (has("double") ? 2 : 1)
      : count === 3 && total >= 4
        ? has("double")
          ? 2
          : 1
        : 0;
  const label = trap
    ? group.players.length
      ? "NO ONE GETS POINTS"
      : "TRAP AVOIDED"
    : cursed && count > 1
      ? "CURSED · RIVALS −1 / CURSED +2"
      : points
        ? `+${points} PTS EACH`
        : count === 1
          ? "UNIQUE · 0 PTS"
          : "TOO POPULAR · 0 PTS";
  return (
    <motion.em
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: "spring" }}
      className={points ? "outcome win" : "outcome"}
    >
      {label}
    </motion.em>
  );
}
function LikePanel({
  room,
  onLike,
}: {
  room: Room;
  onLike: (id: string) => void;
}) {
  const used = Boolean(room.roundLikes[socket.id ?? ""]);
  return (
    <div className="like-panel">
      <b>Pick one favorite answer</b>
      <span>{used ? "Like sent ♥" : "You get one like this round."}</span>
      <div>
        {room.players
          .filter((p) => p.id !== socket.id)
          .map((p) => (
            <button disabled={used} key={p.id} onClick={() => onLike(p.id)}>
              ♥ {p.name}
            </button>
          ))}
      </div>
    </div>
  );
}
function Stats({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string }[];
}) {
  if (!items.length) return null;
  return (
    <section className="stat-panel">
      <h2>{title}</h2>
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            <span>{item.label}</span>
            <b>{item.value}</b>
          </li>
        ))}
      </ol>
    </section>
  );
}
function Score({
  players,
  medals = false,
}: {
  players: Player[];
  medals?: boolean;
}) {
  return (
    <ol className={`score ${medals ? "medals" : ""}`}>
      {players.map((p, i) => (
        <li key={p.id}>
          {medals && (
            <span className={`medal medal-${i}`}>
              {i === 0
                ? "GOLD"
                : i === 1
                  ? "SILVER"
                  : i === 2
                    ? "BRONZE"
                    : `${i + 1}`}
            </span>
          )}
          <span>{medals ? p.name : `${i + 1}. ${p.name}`}</span>
          <b>{p.score} pts</b>
        </li>
      ))}
    </ol>
  );
}
function Podium({ players, count }: { players: Player[]; count: number }) {
  const reveal = [...players].reverse().slice(0, count);
  return (
    <ol className="score medals podium">
      {reveal.map((p) => {
        const rank = players.filter((other) => other.score > p.score).length;
        const place = rank + 1;
        return (
          <motion.li
            key={p.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260 }}
            className={rank < 3 ? "podium-top" : ""}
          >
            <span className={`medal medal-${rank}`}>
              {rank === 0
                ? "GOLD"
                : rank === 1
                  ? "SILVER"
                  : rank === 2
                    ? "BRONZE"
                    : `${place}`}
            </span>
            <span>{p.name}</span>
            <b>{p.score} pts</b>
          </motion.li>
        );
      })}
    </ol>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
