# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **quiz-bot** project — a Telegram bot for tracking and notifying about bar quiz game schedules in **Saratov**. Aggregates games from multiple sources.

## Project Status

**Задеплоен и работает.** Хостинг: [Railway](https://railway.com). CD настроен: push в `main` → автоматический деплой новой версии.

- Бот работает на собственном клиенте (`src/telegram.ts`) через `curl` (зависимость от `telegraf` удалена)
- Данные берутся из нескольких источников через интерфейс `GameSource`
- Все источники используют `curl` (Yandex SmartCaptcha блокирует Node.js TLS fingerprint)

## Project Structure

```
quiz-bot/
├── src/
│   ├── index.ts                # entry point: bot mode (default) or CLI (--parse)
│   ├── bot.ts                  # /schedule command + poll callback; принимает sources: GameSource[]
│   ├── telegram.ts             # собственный Telegram Bot API клиент через curl
│   ├── types.ts                # Game interface + GameSource interface
│   ├── formatter.ts            # formatSchedule() for CLI, buildPollQuestion() for bot
│   └── sources/
│       ├── quizplease.ts       # QuizPleaseSource — REST API api.quizplease.ru (префикс "КП")
│       └── shaker.ts           # ShakerQuizSource — парсинг __NEXT_DATA__ saratov.shakerquiz.ru (префикс "Шейкер")
├── .env                        # BOT_TOKEN, GROUP_CHAT_ID (gitignored)
├── fly.toml                    # Fly.io конфигурация деплоя
├── Dockerfile
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

## Running

```bash
npm start           # запустить бота (требует .env с BOT_TOKEN и GROUP_CHAT_ID)
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

## GameSource Architecture

Каждый источник реализует интерфейс:
```typescript
interface GameSource {
  label: string;               // префикс в выводе бота, напр. "КП", "Шейкер"
  fetchGames(): Promise<Game[]>;
}
```

`bot.ts` агрегирует источники через `Promise.allSettled` (падение одного не ломает остальные),
тегирует каждую игру меткой `sourceLabel` и сортирует по `game.dateTime`.

Префикс `[label]` отображается в: строке игры, кнопке, заголовке опроса.

Чтобы добавить новый источник:
1. Создать `src/sources/newsource.ts` с классом, реализующим `GameSource`
2. Добавить в массив в `src/index.ts`: `[new QuizPleaseSource(), new ShakerQuizSource(), new NewSource()]`

## Sources

### QuizPleaseSource (`src/sources/quizplease.ts`) — префикс "КП"

REST API без авторизации:
```
GET https://api.quizplease.ru/api/games/schedule/57?per_page=100&order=date&statuses[]=0&statuses[]=1&statuses[]=2&statuses[]=3&statuses[]=5
```
- `57` — city_id для Саратова
- Возвращает JSON: `{ status: "ok", data: { data: [...], pagination: {...} } }`

| API поле | Game поле | Примечание |
|---|---|---|
| `id` | `id` | UUID |
| `game_number` | `number` | добавить префикс `#` |
| `title` | `title` | |
| `date` (DD.MM.YYYY HH:MM) | `date` + `time` + `dateTime` | через `Intl.DateTimeFormat('ru-RU')` |
| `place.title` | `venue` | |
| `place.address` | `address` | |
| `price` | `price` | добавить `₽` |
| `status === 0` | `available` | 0 = открыта запись |
| `id` | `url` | `https://quizplease.ru/game-page?id={id}` |

### ShakerQuizSource (`src/sources/shaker.ts`) — префикс "Шейкер"

Парсинг страницы `https://saratov.shakerquiz.ru/` — данные в `<script id="__NEXT_DATA__">` JSON:
- `GET/games/search` — список игр
- `GET/games/venue/:venue/search` — площадки, джойнятся по `game_id`

| JSON поле | Game поле | Примечание |
|---|---|---|
| `id` | `id` | UUID |
| `number` | `number` | добавить префикс `#` |
| `name` | `title` | |
| `event_time` | `date` + `time` + `dateTime` | ISO с ложным "Z" — парсить как локальное время |
| `venue.name` | `venue` | |
| `venue.street` + `venue.house_number` | `address` | strip дублирующего префикса из street |
| `price` | `price` | добавить `₽` |
| `status === "Publish"` | `available` | |

## Game Interface

```typescript
interface Game {
  id: string;
  number: string;    // "#8"
  title: string;     // "Квиз, плиз! SARATOV"
  date: string;      // "28 февраля, Суббота"
  time: string;      // "в 16:30"
  dateTime: Date;    // для сортировки при merge нескольких источников
  venue: string;     // "Пивной дом Klausberg"
  address: string;   // "Рахова 26/40"
  price: string;     // "600₽"
  available: boolean;
  url: string;
}
```
