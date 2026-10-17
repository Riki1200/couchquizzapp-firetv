# Demo video script (3 minutes)

**Story:** a family of four on the couch. The TV (Vega Virtual Device) runs Couch Quiz against the AWS backend; everyone joins from their own phone. Round 1 is a preset topic in two teams; round 2 is a topic one of the kids suggests from their phone, written and fact-checked by the AI host.

**Setup before recording**
- AWS backend deployed (`cd infra && yarn deploy`); the Vega app in the VVD (README → "On the Vega Virtual Device"; it uses the AWS backend by default). Nothing needs to run on your machine besides the VVD.
- 2 real phones + 2 browser windows in mobile size (Chrome DevTools device mode, each in its own incognito window or profile so they count as different players). The QR link works on Wi-Fi or mobile data.
- On the TV: **Settings → Questions per game: 5, Teams: 2 teams**. Start on the Setup screen with no topic selected.
- Play one short game before recording, so the family scores table is not empty.
- Screen layout: VVD large on the left, the phones in a column on the right. Record the TV audio (lobby music and effects).

| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:12 | Title card: Couch Quiz logo over the lobby screen. Caption: "Fire TV · Vega OS · Amazon Bedrock". | "Game night breaks down at the remote: one person plays, everyone else watches. Couch Quiz is a multi-modal game show for Fire TV — the D-pad runs the show, every phone is a buzzer, and an AI host writes the questions." |
| 0:12–0:30 | Remote in hand: **Space** → focus jumps to difficulty → **Easy** → Create room. Show the yellow focus ring vs. the purple "selected" check. | "Everything on the TV works with the D-pad: pick a topic, a difficulty, and create a room." |
| 0:30–0:55 | Lobby: QR code and room code. A real phone scans it: name "Mia" + 🦊 — the avatar pops onto the TV with a red team ring, and the phone says "You're on the 🔴 Red team". The others join; teams balance automatically. | "No app to install: scan, pick a name and an avatar. Tonight it's red team against blue team." |
| 0:55–1:30 | Start game. Question on the TV, four colored buttons on the phones; avatars light up as players lock in; "Everyone answered!". Reveal: the correct answer, the host's quip, points, and the **team bars** next to the leaderboard. Play two questions, then speed up to the end. | "Faster right answers score more, and the last question is worth double. After every answer the AI host drops a one-liner." |
| 1:30–1:50 | Podium: "🔴 Red team wins!", medals, confetti, an AI award for every player. Press **🏆 Family scores**: the table of wins and points kept on this TV. Back. | "At the end, a podium, a winning team and an award for everyone — and the family table remembers who's ahead this month." |
| 1:50–2:25 | Press **New topic** → back in the lobby with everyone still in. On a phone, type **"Volcanoes"** in "Suggest a topic" → it appears on the TV → select it with the remote. Status: "The AI host wrote 5 questions about Volcanoes and a second AI fact-checked them". Show one AI-written question and its reveal. | "Anyone can pick the topic from their phone. The AI host on Amazon Bedrock writes a fresh game in seconds — and a second model fact-checks every question before you play it." |
| 2:25–2:35 | Quick cut: Custom topic screen → the three **"Surprise me"** ideas, picked with the D-pad. | "No ideas? Ask the host — no typing with the remote." |
| 2:35–2:55 | Architecture diagram from the README: Vega app + phones → API Gateway (HTTP + WebSocket) → Lambda → DynamoDB and Amazon Bedrock (writer + fact-checker); the HTTP API also serves the phone page. | "Under the hood: React Native for Vega, running here on the Vega Virtual Device, and a serverless AWS backend built with CDK — API Gateway WebSockets, Lambda, DynamoDB, and two models on Amazon Bedrock: one writes, one fact-checks." |
| 2:55–3:00 | Back to the podium screen. | "Couch Quiz: the whole family, one screen, every phone." |

**Before uploading**
- Keep it under **3:00**; judges don't have to watch past that.
- Upload to **YouTube or Vimeo as Public**, in English (voice-over or captions), and paste the link into the Devpost form.
- No third-party logos, music or footage. All app sounds and music are original, so recording the TV audio is fine. Hide browser bookmarks, other apps and notifications while recording.

**Tips**
- Keep the remote presses visible (overlay a small D-pad graphic or call them out) — the 10-foot UI is part of the judging.
- Record the TV audio; the music and the lock-in sounds make the game feel alive.
- To show reconnection, turn on airplane mode on one phone for 5 s during the lobby: its avatar dims and comes back with the same name and score.
- A custom topic takes about 6–10 s to write and check; start it while the players are still joining, or cut the wait in editing.
