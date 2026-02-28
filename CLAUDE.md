# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **quiz-bot** project — a bot (likely Telegram) for tracking and notifying about [Quiz Please](https://quizplease.ru/) game schedules. Quiz Please is a Russian bar quiz franchise. The target city is **Saratov**.

## Project Status

Phase 2 complete: live fetching from `saratov.quizplease.ru/schedule` + HTML parsing → Markdown output.

**Next step:** Telegram bot integration.

## Project Structure

```
quiz-bot/
├── src/
│   ├── index.ts       # entry point: fetches (live) or reads (--local) HTML, calls parser and formatter
│   ├── fetcher.ts     # fetches live HTML via curl subprocess (bypasses Yandex SmartCaptcha)
│   ├── parser.ts      # cheerio HTML parsing → Game[]
│   └── formatter.ts   # Game[] → Markdown string
├── data/
│   ├── Расписание игр.html        # saved schedule page from saratov.quizplease.ru/schedule
│   └── Расписание игр_files/      # static assets for the saved page
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

## Running

```bash
npm start          # fetch live schedule from saratov.quizplease.ru → Markdown to stdout
npm start --local  # parse saved data/Расписание игр.html instead of fetching
npm run build      # compile TypeScript to dist/
```

## Data Source

The primary data source is the Quiz Please schedule page for Saratov:
- URL: `https://saratov.quizplease.ru/schedule`
- The page is in Russian
- HTML is server-side rendered — the game data is present in the raw HTML response
- **Yandex SmartCaptcha** blocks Node.js's built-in `fetch`/`https` (TLS fingerprint detection); `curl` passes through fine — so fetching is done via `execFile('curl', ...)`

## HTML Selectors (saratov.quizplease.ru/schedule)

Each game is a `div.schedule-column` with `id=GAME_ID`:

| Field       | Selector |
|-------------|----------|
| Date        | `.block-date-with-language-game` |
| Title       | `.h2-game-card.h2-left` |
| Number      | `.h2-game-card` (second, not `.h2-left`) |
| Venue       | `.schedule-block-info-bar` — strip inner `<button>` ("Информация о площадке") |
| Address     | `.techtext-halfwhite` first — strip "Где это?" link text |
| Time        | second `.schedule-info` → `.techtext` first |
| Price       | `.price` |
| Availability| `.schedule-block.available` vs `.schedule-block.soldout` |

## Game Interface

```typescript
interface Game {
  id: string;
  number: string;    // "#8"
  title: string;     // "Квиз, плиз! [сюрприз] SARATOV"
  date: string;      // "28 февраля, Суббота"
  time: string;      // "в 16:30"
  venue: string;     // "Пивной дом Klausberg"
  address: string;   // "Рахова 26/40"
  price: string;     // "600₽"
  available: boolean;
  url: string;
}
```
