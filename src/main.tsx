import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { io, Socket } from "socket.io-client";
import "./styles.css";
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
  submitted: number;
};
const socket: Socket = io(
  `${window.location.protocol}//${window.location.hostname}:3001`,
);
function App() {
  const [room, setRoom] = useState<Room | null>(null),
    [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [rounds, setRounds] = useState(3),
    [bot, setBot] = useState(true),
    [answer, setAnswer] = useState(""),
    [error, setError] = useState("");
  const isHost = room?.hostId === socket.id;
  useEffect(() => {
    socket.on("room:update", setRoom);
    return () => {
      socket.off("room:update", setRoom);
    };
  }, []);
  const call = (event: string, data?: object) =>
    socket.emit(event, data, (r: { room?: Room; error?: string } = {}) => {
      if (r.error) setError(r.error);
      if (r.room) setRoom(r.room);
    });
  if (!room)
    return (
      <main>
        <div className="logo">
          BLANK <i>SLATE</i>
        </div>
        <p className="tag">A surprisingly revealing game of matching minds.</p>
        <section className="card welcome">
          <label>
            Your name
            <input
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sam"
            />
          </label>
          <button onClick={() => call("room:create", { name, rounds, bot })}>
            Create a game
          </button>
          <div className="or">or join friends</div>
          <label>
            Room code
            <input
              value={code}
              maxLength={4}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD"
            />
          </label>
          <button
            className="secondary"
            onClick={() => call("room:join", { name, code })}
          >
            Join game
          </button>
          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  const sorted = [...room.players].sort((a, b) => b.score - a.score);
  return (
    <main>
      <header>
        <div className="logo">
          BLANK <i>SLATE</i>
        </div>
        <span className="roomcode">
          ROOM <b>{room.code}</b>
        </span>
      </header>
      {room.phase === "lobby" && (
        <section className="card">
          <h1>Gather your cleverest friends</h1>
          <p>
            Share room code <strong>{room.code}</strong> · {room.players.length}
            /8 players
          </p>
          <div className="players">
            {room.players.map((p) => (
              <span key={p.id}>
                {p.name}
                {p.id === room.hostId ? " ★" : ""}
              </span>
            ))}
          </div>
          {isHost && (
            <>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={room.bot}
                  onChange={(e) =>
                    call("lobby:settings", {
                      bot: e.target.checked,
                      rounds: room.rounds,
                    })
                  }
                />{" "}
                AI Wildcard Bot <small>adds one hidden answer</small>
              </label>
              <label>
                Rounds
                <select
                  value={room.rounds}
                  onChange={(e) =>
                    call("lobby:settings", {
                      bot: room.bot,
                      rounds: +e.target.value,
                    })
                  }
                >
                  {[3, 5, 7].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <button onClick={() => call("game:start")}>Start game</button>
            </>
          )}
          {!isHost && <p className="waiting">Waiting for the host to start…</p>}
          {error && <p className="error">{error}</p>}
        </section>
      )}
      {room.phase === "answering" && (
        <section className="card game">
          <div className="progress">
            ROUND {room.round} OF {room.rounds} · {room.submitted}/
            {room.players.length} READY
          </div>
          <h2>{room.prompt}</h2>
          <p>Fill the blank with one word. Think alike to score.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              call("answer:submit", { answer });
            }}
          >
            <input
              autoFocus
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Your one-word answer"
            />
            <button>Lock it in</button>
          </form>
          {room.answers[socket.id ?? ""] && (
            <p className="waiting">Answer locked. Waiting for everyone…</p>
          )}
          {error && <p className="error">{error}</p>}
        </section>
      )}
      {room.phase === "reveal" && (
        <section className="card game">
          <div className="progress">ROUND {room.round} RESULTS</div>
          <h2>{room.prompt}</h2>
          <div className="reveals">
            {room.players.map((p) => (
              <div key={p.id}>
                <b>{p.name}</b>
                <span>{room.answers[p.id]}</span>
              </div>
            ))}
            {room.bot && (
              <div className="bot">
                <b>✦ AI WILDCARD</b>
                <span>{room.botAnswer}</span>
              </div>
            )}
          </div>
          <Score players={sorted} />
          {isHost ? (
            <button onClick={() => call("round:continue")}>
              {room.round === room.rounds
                ? "See final leaderboard"
                : "Next round"}
            </button>
          ) : (
            <p className="waiting">Waiting for host…</p>
          )}
        </section>
      )}
      {room.phase === "finished" && (
        <section className="card game">
          <div className="progress">GAME COMPLETE</div>
          <h1>{sorted[0]?.name} wins!</h1>
          <Score players={sorted} />
          <p className="waiting">Thanks for playing.</p>
        </section>
      )}
    </main>
  );
}
function Score({ players }: { players: Player[] }) {
  return (
    <ol className="score">
      {players.map((p, i) => (
        <li key={p.id}>
          <span>
            {i + 1}. {p.name}
          </span>
          <b>{p.score} pts</b>
        </li>
      ))}
    </ol>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
