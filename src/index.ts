import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createBot } from './bot';
import { fetchScheduleHtml } from './fetcher';
import { parseSchedule } from './parser';
import { formatSchedule } from './formatter';

// CLI mode: npm start --local  →  print Markdown to stdout
if (process.argv.includes('--local')) {
  const html = fs.readFileSync(
    path.join(__dirname, '..', 'data', 'Расписание игр.html'),
    'utf-8'
  );
  const games = parseSchedule(html);
  console.log(formatSchedule(games));
  console.error(`\nПарсинг завершён: найдено ${games.length} игр.`);
  process.exit(0);
}

// CLI mode: npm start --parse  →  fetch live and print Markdown to stdout
if (process.argv.includes('--parse')) {
  (async () => {
    const html = await fetchScheduleHtml();
    const games = parseSchedule(html);
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

  bot.launch().then(() => {
    console.log('Бот запущен. Нажмите Ctrl+C для остановки.');
  });

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
