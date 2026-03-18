# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **quiz-bot** project — a Telegram bot for tracking and notifying about [Quiz Please](https://quizplease.ru/) game schedules. Quiz Please is a Russian bar quiz franchise. The target city is **Saratov**.

## Project Status

**Задеплоен и работает.** Хостинг: [Railway](https://railway.com). CD настроен: push в `main` → автоматический деплой новой версии.

- Бот работает на собственном клиенте (`src/telegram.ts`) через `curl` (зависимость от `telegraf` удалена)
- Данные берутся из REST API `api.quizplease.ru` (сайт переехал на Nuxt.js, HTML-парсинг удалён)

## Project Structure

```
quiz-bot/
├── src/
│   ├── index.ts       # entry point: bot mode (default) or CLI (--parse)
│   ├── bot.ts         # /schedule command + poll callback; uses TelegramBot from telegram.ts
│   ├── telegram.ts    # собственный Telegram Bot API клиент через curl (polling, sendMessage, sendPoll, …)
│   ├── fetcher.ts     # fetchScheduleGames() → REST API api.quizplease.ru через curl
│   ├── parser.ts      # JSON → Game[] (parseSchedule + parseDate)
│   └── formatter.ts   # formatSchedule() for CLI, buildPollQuestion() for bot
├── .env                           # BOT_TOKEN, GROUP_CHAT_ID (gitignored)
├── fly.toml                       # Fly.io конфигурация деплоя
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

## Data Source

REST API без авторизации:
```
GET https://api.quizplease.ru/api/games/schedule/57?per_page=100&order=date&statuses[]=0&statuses[]=1&statuses[]=2&statuses[]=3&statuses[]=5
```
- `57` — city_id для Саратова
- Возвращает JSON: `{ status: "ok", data: { data: [...], pagination: {...} } }`
- **Yandex SmartCaptcha** блокирует Node.js `fetch`/`https` (TLS fingerprint); `curl` проходит — поэтому fetcher и Telegram API используют `curl`

## API → Game маппинг

| API поле | Game поле | Примечание |
|---|---|---|
| `id` | `id` | UUID |
| `game_number` | `number` | добавить префикс `#` |
| `title` | `title` | |
| `date` (DD.MM.YYYY HH:MM) | `date` + `time` | конвертируется через `Intl.DateTimeFormat('ru-RU')` |
| `place.title` | `venue` | |
| `place.address` | `address` | |
| `price` | `price` | добавить `₽` |
| `status === 0` | `available` | 0 = открыта запись |
| `id` | `url` | `https://quizplease.ru/game-page?id={id}` |

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
