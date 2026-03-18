import 'dotenv/config';
import { createBot } from './bot';
import { QuizPleaseSource } from './sources/quizplease';
import { ShakerQuizSource } from './sources/shaker';
import { formatSchedule } from './formatter';

// CLI mode: npm start --parse  →  fetch live and print Markdown to stdout
if (process.argv.includes('--parse')) {
  (async () => {
    const games = await new QuizPleaseSource().fetchGames();
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

  const sources = [new QuizPleaseSource(), new ShakerQuizSource()];
  const bot = createBot(token, groupChatId, sources);

  process.once('SIGINT', () => { bot.stop(); process.exit(0); });
  process.once('SIGTERM', () => { bot.stop(); process.exit(0); });

  bot.launch().catch((err) => {
    console.error('Критическая ошибка:', err.message);
    process.exit(1);
  });
}
