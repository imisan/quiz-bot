import 'dotenv/config';
import { createBot } from './bot';
import { fetchScheduleGames } from './fetcher';
import { parseSchedule } from './parser';
import { formatSchedule } from './formatter';

// CLI mode: npm start --parse  →  fetch live and print Markdown to stdout
if (process.argv.includes('--parse')) {
  (async () => {
    const rawGames = await fetchScheduleGames();
    const games = parseSchedule(rawGames);
    console.log(formatSchedule(games));
    console.error(`\nПарсинг завершён: найдено ${games.length} игр.`);
  })().catch((err) => {
    console.error('Ошибка:', err.message);
    process.exit(1);
  });
} else {
  // Bot mode (default)
  const token = process.env.BOT_TOKEN;
  const groupChatId = process.env.GROUP_CHAT_ID;

  if (!token) {
    console.error('Ошибка: BOT_TOKEN не задан в .env');
    process.exit(1);
  }
  if (!groupChatId) {
    console.error('Ошибка: GROUP_CHAT_ID не задан в .env');
    process.exit(1);
  }

  const bot = createBot(token, groupChatId);

  process.once('SIGINT', () => { bot.stop(); process.exit(0); });
  process.once('SIGTERM', () => { bot.stop(); process.exit(0); });

  bot.launch().catch((err) => {
    console.error('Критическая ошибка:', err.message);
    process.exit(1);
  });
}
