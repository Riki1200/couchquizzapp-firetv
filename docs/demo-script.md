# Demo video script (3 minutes)

**Story:** a family of four on the couch plays a round of "Space" in Kids mode. Everyone uses their own phone; the TV runs in the Vega Virtual Device.

**Setup before recording**
- `yarn play` (server, phone page, web TV) and the Vega app in the VVD (see README → "On the Vega Virtual Device").
- 1 real phone + 3 browser windows in mobile size (Chrome DevTools device mode), each in a separate profile or incognito window so they count as different players.
- Screen layout: VVD large on the left, the phones in a column on the right. System audio recorded (lobby music and effects).
- Start in the Setup screen with no topic selected.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:15 | Title card: Couch Quiz logo over the lobby screen | "Game night, but nobody wants to pass a controller around. Couch Quiz turns your Fire TV into a game show — and every phone in the room into a buzzer." |
| 0:15–0:40 | Remote in hand: pick **Space** → focus jumps to difficulty → **Kids** → Create room. Show the yellow focus ring vs. the purple "selected" state. | "Everything on the TV works with the D-pad. Pick a topic — or type your own — choose a difficulty, and create a room." |
| 0:40–1:05 | Lobby: QR code and room code. Real phone scans it; name "Mia" + 🦊; the avatar pops onto the TV with the join sound. The other three join from the browser windows. Lobby music playing. | "No app to install: scan the code, pick a name and an avatar, and you're on the TV." |
| 1:05–1:50 | Start game. Question on the TV, four colored buttons on the phones. Two players answer fast, one slow; "locked in" avatars appear on the TV. Reveal: correct answer highlighted, the host's quip, points per player. Play two questions. | "Faster right answers score more. In Kids mode there's no timer pressure. After every answer, the AI host drops a one-liner." |
| 1:50–2:10 | Disconnect one phone (turn on airplane mode for 5 s); its avatar dims on the TV; it comes back with the same score. | "Phones drop off Wi-Fi all the time. Couch Quiz reconnects them automatically, score intact." |
| 2:10–2:35 | Skip to the last question (the rest of the round, sped up). Podium with medals and the AI awards ("Fastest Finger", "Comeback Kid"…). Fanfare. | "At the end: a podium, and an award for every player — the host celebrates everyone, not just the winner." |
| 2:35–3:00 | Architecture diagram from the README: Vega app + phones → API Gateway (HTTP + WebSocket) → Lambda → DynamoDB and Amazon Bedrock; the HTTP API also serves the phone page. | "Under the hood: React Native for Vega on the TV, and a serverless AWS backend — API Gateway WebSockets, Lambda, DynamoDB, and Amazon Bedrock as the AI host. Couch Quiz: the whole family, one screen, zero controllers." |

**Tips**
- Keep the remote presses visible (overlay a small D-pad graphic or call them out) — the 10-foot UI is part of the judging.
- Record the TV audio; the music and the lock-in sounds make the game feel alive.
- If Bedrock is enabled by recording time, use a custom topic for one round (e.g. "Our family trip to the beach") to show AI-written questions; otherwise the preset topics come from the built-in question bank.
