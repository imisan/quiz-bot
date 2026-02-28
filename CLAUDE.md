# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **quiz-bot** project — a Telegram bot for tracking and notifying about [Quiz Please](https://quizplease.ru/) game schedules. Quiz Please is a Russian bar quiz franchise. The target city is **Saratov**.

## Project Status

Phase 3 complete: Telegram-бот с командой `/schedule` и публикацией опросов в группу.
Зависимость от `telegraf` удалена — бот работает на собственном клиенте (`src/telegram.ts`) через `curl`.

**Next step:** деплой (запуск на сервере).

## Project Structure

```
quiz-bot/
├── src/
│   ├── index.ts       # entry point: bot mode (default) or CLI (--local / --parse)
│   ├── bot.ts         # /schedule command + poll callback; uses TelegramBot from telegram.ts
│   ├── telegram.ts    # собственный Telegram Bot API клиент через curl (polling, sendMessage, sendPoll, …)
│   ├── fetcher.ts     # fetches live HTML via curl subprocess (bypasses Yandex SmartCaptcha)
│   ├── parser.ts      # cheerio HTML parsing → Game[]
│   └── formatter.ts   # formatSchedule() for CLI, buildPollQuestion() for bot
├── data/
│   ├── Расписание игр.html        # saved schedule page from saratov.quizplease.ru/schedule
│   └── Расписание игр_files/      # static assets for the saved page
├── .env                           # BOT_TOKEN, GROUP_CHAT_ID (gitignored)
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

## Running

```bash
npm start           # запустить бота (требует .env с BOT_TOKEN и GROUP_CHAT_ID)
npm start --local   # CLI: распарсить сохранённый HTML → Markdown в stdout
npm start --parse   # CLI: живой fetch → Markdown в stdout
npm run build       # компиляция TypeScript в dist/
```

## Bot Setup

1. Создать бота через @BotFather → получить `BOT_TOKEN`
2. Добавить бота в группу как участника
3. Узнать `GROUP_CHAT_ID`: отправить сообщение в группу → открыть `https://api.telegram.org/bot<TOKEN>/getUpdates` → найти `"chat":{"id":-100...}`
4. Заполнить `.env`:
   ```
   BOT_TOKEN=токен_от_BotFather
   GROUP_CHAT_ID=-1001234567890
   ```
5. `npm start`

## Data Source

The primary data source is the Quiz Please schedule page for Saratov:
- URL: `https://saratov.quizplease.ru/schedule`
- The page is in Russian
- HTML is server-side rendered — the game data is present in the raw HTML response
- **Yandex SmartCaptcha** blocks Node.js's built-in `fetch`/`https` (TLS fingerprint detection); `curl` passes through fine — поэтому и HTML-fetching (`fetcher.ts`), и Telegram API (`telegram.ts`) используют `curl`

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
