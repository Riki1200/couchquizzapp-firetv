import { ReactNode, useEffect, useState } from 'react';
import { ANSWER_STYLES, AVATARS, GetRoomResponse, MAX_NAME_LENGTH } from '@couch-quiz/protocol';
import { endpoints, useGameSocket, View } from './useGameSocket';

export default function App() {
  const [room, setRoom] = useState(() => new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '');
  const [roomStatus, setRoomStatus] = useState<'checking' | 'ok' | 'missing'>(room ? 'checking' : 'missing');

  useEffect(() => {
    if (room.length !== 4) return setRoomStatus('missing');
    setRoomStatus('checking');
    fetch(`${endpoints.httpUrl}/rooms/${room}`)
      .then((r) => r.json() as Promise<GetRoomResponse>)
      .then((r) => setRoomStatus(r.exists ? 'ok' : 'missing'))
      .catch(() => setRoomStatus('missing'));
  }, [room]);

  if (roomStatus === 'checking') return <Shell>Connecting…</Shell>;
  if (roomStatus === 'missing') return <RoomCodeForm initial={room} onSubmit={setRoom} notFound={room.length === 4} />;
  return <Game room={room} />;
}

function Shell({ children, room }: { children: ReactNode; room?: string }) {
  return (
    <div className="shell">
      <header>
        <span className="logo">Couch Quiz</span>
        {room ? <span className="room">Room {room}</span> : null}
      </header>
      <main>{children}</main>
    </div>
  );
}

function RoomCodeForm({ initial, notFound, onSubmit }: { initial: string; notFound: boolean; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState(initial);
  return (
    <Shell>
      <h1>Join a game</h1>
      <p className="muted">Enter the 4-letter room code shown on the TV.</p>
      {notFound ? <p className="error">Room {initial} was not found. Check the code on the TV.</p> : null}
      <input
        className="code-input"
        value={code}
        maxLength={4}
        autoCapitalize="characters"
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
      />
      <button className="primary" disabled={code.length !== 4} onClick={() => onSubmit(code)}>
        Continue
      </button>
    </Shell>
  );
}

function Game({ room }: { room: string }) {
  const { view, player, connected, hostLeft, error, send } = useGameSocket(room);
  return (
    <Shell room={room}>
      {!connected ? <div className="banner">Reconnecting…</div> : hostLeft ? <div className="banner">Waiting for the TV…</div> : null}
      {error ? <p className="error">{error}</p> : null}
      {!player ? <JoinForm onJoin={(name, avatar) => send({ action: 'join', name, avatar })} /> : <PlayerView view={view} send={send} name={player.name} avatar={player.avatar} />}
    </Shell>
  );
}

function JoinForm({ onJoin }: { onJoin: (name: string, avatar: string) => void }) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  return (
    <>
      <h1>Who's playing?</h1>
      <input
        className="name-input"
        placeholder="Your name"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="avatars">
        {AVATARS.map((a) => (
          <button key={a} className={a === avatar ? 'avatar selected' : 'avatar'} onClick={() => setAvatar(a)}>
            {a}
          </button>
        ))}
      </div>
      <button className="primary" disabled={!name.trim()} onClick={() => onJoin(name.trim(), avatar)}>
        Join game
      </button>
    </>
  );
}

function PlayerView({
  view,
  send,
  name,
  avatar,
}: {
  view: View;
  send: ReturnType<typeof useGameSocket>['send'];
  name: string;
  avatar: string;
}) {
  switch (view.kind) {
    case 'join':
    case 'lobby':
      return (
        <div className="center">
          <div className="big-avatar">{avatar}</div>
          <h1>You're in, {name}!</h1>
          <p className="muted">
            {view.kind === 'lobby' && view.topic ? `Topic: ${view.topic}. ` : ''}Look at the TV — the game starts soon.
          </p>
        </div>
      );
    case 'question':
      return <QuestionPad view={view} onAnswer={(choice) => send({ action: 'answer', index: view.index, choice })} />;
    case 'reveal':
      return (
        <div className={`center result ${view.correct ? 'good' : 'bad'}`}>
          <div className="big-avatar">{view.correct ? '🎉' : '🙈'}</div>
          <h1>{view.correct ? `Correct! +${view.points}` : 'Not this time'}</h1>
          {!view.correct ? (
            <p>
              The answer was {ANSWER_STYLES[view.correctIndex].letter}: {view.choices[view.correctIndex]}
            </p>
          ) : null}
          <p className="muted">Your score: {view.total}</p>
        </div>
      );
    case 'over':
      return (
        <div className="center">
          <div className="big-avatar">{view.rank === 1 ? '🏆' : avatar}</div>
          <h1>
            #{view.rank} of {view.playerCount}
          </h1>
          <p className="muted">{view.score} points</p>
          {view.title ? (
            <div className="award">
              <strong>{view.title}</strong>
              <span>{view.line}</span>
            </div>
          ) : null}
          <p className="muted">Thanks for playing! Stay here for the next game.</p>
        </div>
      );
  }
}

function QuestionPad({ view, onAnswer }: { view: Extract<View, { kind: 'question' }>; onAnswer: (choice: number) => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (view.deadline === null) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [view.deadline]);

  const secondsLeft = view.deadline === null ? null : Math.max(0, Math.ceil((view.deadline - now) / 1000));
  const locked = view.answered !== null || secondsLeft === 0;

  return (
    <div className="question">
      <div className="question-meta">
        <span>
          {view.index + 1} / {view.total}
        </span>
        <span>{secondsLeft === null ? 'No timer' : `${secondsLeft}s`}</span>
      </div>
      <p className="question-text">{view.text}</p>
      <div className="answers">
        {view.choices.map((choice, i) => (
          <button
            key={i}
            className={`answer ${view.answered === i ? 'picked' : ''} ${locked && view.answered !== i ? 'faded' : ''}`}
            style={{ background: ANSWER_STYLES[i].color }}
            disabled={locked}
            onClick={() => onAnswer(i)}
          >
            <span className="letter">{ANSWER_STYLES[i].letter}</span>
            <span>{choice}</span>
          </button>
        ))}
      </div>
      {view.answered !== null ? <p className="center muted">Locked in! Look at the TV.</p> : null}
      {view.answered === null && secondsLeft === 0 ? <p className="center muted">Time's up!</p> : null}
    </div>
  );
}
