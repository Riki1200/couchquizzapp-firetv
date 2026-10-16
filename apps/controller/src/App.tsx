import { ReactNode, useEffect, useState } from 'react';
import { ANSWER_STYLES, AVATARS, GetRoomResponse, Language, MAX_NAME_LENGTH } from '@couch-quiz/protocol';
import { LanguageContext, useT } from './i18n';
import { endpoints, useGameSocket, View } from './useGameSocket';

export default function App() {
  const [room, setRoom] = useState(() => new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '');
  const [roomStatus, setRoomStatus] = useState<'checking' | 'ok' | 'missing'>(room ? 'checking' : 'missing');
  const [language, setLanguage] = useState<Language>(navigator.language.startsWith('es') ? 'es' : 'en');

  useEffect(() => {
    if (room.length !== 4) return setRoomStatus('missing');
    setRoomStatus('checking');
    fetch(`${endpoints.httpUrl}/rooms/${room}`)
      .then((r) => r.json() as Promise<GetRoomResponse>)
      .then((r) => {
        if (r.language) setLanguage(r.language);
        setRoomStatus(r.exists ? 'ok' : 'missing');
      })
      .catch(() => setRoomStatus('missing'));
  }, [room]);

  return (
    <LanguageContext.Provider value={language}>
      {roomStatus === 'checking' ? (
        <Shell>
          <Connecting />
        </Shell>
      ) : roomStatus === 'missing' ? (
        <RoomCodeForm initial={room} onSubmit={setRoom} notFound={room.length === 4} />
      ) : (
        <Game room={room} onLanguage={setLanguage} />
      )}
    </LanguageContext.Provider>
  );
}

function Connecting() {
  const { t } = useT();
  return <p className="center muted pulse">{t('phone.connecting')}</p>;
}

function Shell({ children, room }: { children: ReactNode; room?: string }) {
  const { t } = useT();
  return (
    <div className="shell">
      <header>
        <span className="logo">🛋️ Couch Quiz</span>
        {room ? <span className="room">{t('phone.room', { code: room })}</span> : null}
      </header>
      <main>{children}</main>
    </div>
  );
}

function RoomCodeForm({ initial, notFound, onSubmit }: { initial: string; notFound: boolean; onSubmit: (code: string) => void }) {
  const { t } = useT();
  const [code, setCode] = useState(initial);
  return (
    <Shell>
      <div className="view">
        <h1>{t('phone.joinTitle')}</h1>
        <p className="muted">{t('phone.joinHint')}</p>
        {notFound ? <p className="error">{t('phone.roomNotFound', { code: initial })}</p> : null}
        <input
          className="code-input"
          value={code}
          maxLength={4}
          autoCapitalize="characters"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
        />
      </div>
      <button className="primary" disabled={code.length !== 4} onClick={() => onSubmit(code)}>
        {t('phone.continue')}
      </button>
    </Shell>
  );
}

function Game({ room, onLanguage }: { room: string; onLanguage: (language: Language) => void }) {
  const { t } = useT();
  const { view, player, connected, hostLeft, error, send } = useGameSocket(room, onLanguage);
  return (
    <Shell room={room}>
      {!connected ? (
        <div className="banner">{t('phone.reconnecting')}</div>
      ) : hostLeft ? (
        <div className="banner">{t('phone.waitingTv')}</div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {!player ? (
        <JoinForm onJoin={(name, avatar) => send({ action: 'join', name, avatar })} />
      ) : (
        <PlayerView view={view} send={send} name={player.name} avatar={player.avatar} />
      )}
    </Shell>
  );
}

function JoinForm({ onJoin }: { onJoin: (name: string, avatar: string) => void }) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  return (
    <>
      <div className="view">
        <h1>{t('phone.who')}</h1>
        <input
          className="name-input"
          placeholder={t('phone.name')}
          value={name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="avatars">
          {AVATARS.map((a, i) => (
            <button
              key={a}
              className={a === avatar ? 'avatar selected' : 'avatar'}
              style={{ animationDelay: `${i * 30}ms` }}
              onClick={() => setAvatar(a)}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <button className="primary" disabled={!name.trim()} onClick={() => onJoin(name.trim(), avatar)}>
        {t('phone.join')}
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
  const { t, topicLabel } = useT();
  switch (view.kind) {
    case 'join':
    case 'lobby':
      return (
        <div className="center view" key="lobby">
          <div className="big-avatar bob">{avatar}</div>
          <h1>{t('phone.youreIn', { name })}</h1>
          <p className="muted">
            {view.kind === 'lobby' && view.topic ? `${t('phone.topic', { topic: topicLabel(view.topic) })} ` : ''}
            {t('phone.lookAtTv')}
          </p>
        </div>
      );
    case 'question':
      return (
        <QuestionPad
          key={view.index}
          view={view}
          onAnswer={(choice) => {
            navigator.vibrate?.(30);
            send({ action: 'answer', index: view.index, choice });
          }}
        />
      );
    case 'reveal':
      return (
        <div className={`center view result ${view.correct ? 'good' : 'bad'}`} key={`reveal-${view.total}-${view.correctIndex}`}>
          <div className={`flash ${view.correct ? 'good' : 'bad'}`} />
          <div className="big-avatar pop">{view.correct ? '🎉' : '🙈'}</div>
          <h1 className={view.correct ? 'pop' : 'shake'}>{view.correct ? t('phone.correct', { points: view.points }) : t('phone.wrong')}</h1>
          {!view.correct ? (
            <p>{t('phone.answerWas', { letter: ANSWER_STYLES[view.correctIndex].letter, answer: view.choices[view.correctIndex] })}</p>
          ) : null}
          <p className="muted">{t('phone.score', { score: view.total })}</p>
        </div>
      );
    case 'over':
      return (
        <div className="center view" key="over">
          {view.rank <= 3 ? <PhoneConfetti /> : null}
          <div className="big-avatar pop">{view.rank === 1 ? '🏆' : avatar}</div>
          <h1>{t('phone.rank', { rank: view.rank, count: view.playerCount })}</h1>
          <p className="muted">{t('phone.points', { score: view.score })}</p>
          {view.title ? (
            <div className="award">
              <strong>{view.title}</strong>
              <span>{view.line}</span>
            </div>
          ) : null}
          <p className="muted">{t('phone.thanks')}</p>
        </div>
      );
  }
}

function QuestionPad({ view, onAnswer }: { view: Extract<View, { kind: 'question' }>; onAnswer: (choice: number) => void }) {
  const { t } = useT();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (view.deadline === null) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [view.deadline]);

  const secondsLeft = view.deadline === null ? null : Math.max(0, Math.ceil((view.deadline - now) / 1000));
  const locked = view.answered !== null || secondsLeft === 0;
  // Time left when the question arrived; the CSS bar drains over exactly that long.
  const [totalMs] = useState(() => (view.deadline === null ? 0 : Math.max(1, view.deadline - Date.now())));

  return (
    <div className="question view">
      <div className="question-meta">
        <span>
          {view.index + 1} / {view.total}
        </span>
        <span className={secondsLeft !== null && secondsLeft <= 5 ? 'urgent' : ''}>
          {secondsLeft === null ? t('phone.noTimer') : `${secondsLeft}s`}
        </span>
      </div>
      {view.deadline !== null ? (
        // Pure CSS countdown: drains smoothly from the time left when the question arrived.
        <div className="timebar">
          <div className="timebar-fill" style={{ animationDuration: `${totalMs}ms` }} />
        </div>
      ) : null}
      <p className="question-text">{view.text}</p>
      <div className="answers">
        {view.choices.map((choice, i) => (
          <button
            key={i}
            className={`answer ${view.answered === i ? 'picked' : ''} ${locked && view.answered !== i ? 'faded' : ''}`}
            style={{ background: ANSWER_STYLES[i].color, animationDelay: `${i * 70}ms` }}
            disabled={locked}
            onClick={() => onAnswer(i)}
          >
            <span className="letter">{ANSWER_STYLES[i].letter}</span>
            <span>{choice}</span>
          </button>
        ))}
      </div>
      {view.answered !== null ? <p className="center muted pop">{t('phone.lockedIn')}</p> : null}
      {view.answered === null && secondsLeft === 0 ? <p className="center muted">{t('phone.timesUp')}</p> : null}
    </div>
  );
}

const CONFETTI_COLORS = ['#FFD23F', '#14B8A6', '#F97316', '#EC4899', '#6366F1', '#2ECC71'];

/** CSS confetti for the top three. */
function PhoneConfetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 12) * 0.25}s`,
            animationDuration: `${3 + (i % 5) * 0.4}s`,
          }}
        />
      ))}
    </div>
  );
}
