import { TelegramBot, Update } from './telegram';
import { Game, GameSource } from './types';
import { buildPollQuestion } from './formatter';

type TaggedGame = Game & { sourceLabel: string };

const POLL_OPTIONS = [
  'Да, иду 💯%',
  'Нет, не смогу 😔',
  'Думаю 🤔⏳',
  'Играю за другую команду 🚶',
  'Со мной +1 👯',
];

export function createBot(token: string, groupChatId: string, sources: GameSource[]): TelegramBot {
  const bot = new TelegramBot(token);

  // In-memory cache of games for the current session
  const gameCache = new Map<string, TaggedGame>();

  async function handleUpdate(update: Update): Promise<void> {
    // Handle commands
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      if (text === '/start' || text.startsWith('/start@')) {
        await bot.sendMessage(
          chatId,
          'Привет! Я бот для расписания Quiz Please Саратов.\n\nКоманды:\n/schedule — показать расписание игр'
        );
        return;
      }

      if (text === '/schedule' || text.startsWith('/schedule@')) {
        const statusMsg = await bot.sendMessage(chatId, '⏳ Загружаю расписание...');
        try {
          console.log(`[schedule] fetching from ${sources.length} sources: ${sources.map(s => s.label).join(', ')}`);
          const results = await Promise.allSettled(sources.map(s => s.fetchGames()));

          const failedLabels: string[] = [];
          results.forEach((r, i) => {
            const label = sources[i].label;
            if (r.status === 'fulfilled') {
              console.log(`[${label}] OK — ${r.value.length} games`);
            } else {
              console.error(`[${label}] FAILED:`, r.reason);
              failedLabels.push(label);
            }
          });

          const games: TaggedGame[] = results
            .flatMap((r, i) => r.status === 'fulfilled'
              ? r.value.map(g => ({ ...g, sourceLabel: sources[i].label }))
              : []
            )
            .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

          await bot.deleteMessage(chatId, statusMsg.message_id);

          if (failedLabels.length > 0) {
            await bot.sendMessage(chatId, `⚠️ Не удалось загрузить: ${failedLabels.map(l => `[${l}]`).join(', ')}`);
          }

          if (games.length === 0) {
            await bot.sendMessage(chatId, 'Игры не найдены.');
            return;
          }

          gameCache.clear();
          for (const game of games) {
            gameCache.set(game.id, game);
          }

          // Group by date → one message per date
          const dateOrder: string[] = [];
          const byDate = new Map<string, TaggedGame[]>();
          for (const game of games) {
            if (!byDate.has(game.date)) {
              byDate.set(game.date, []);
              dateOrder.push(game.date);
            }
            byDate.get(game.date)!.push(game);
          }

          for (const date of dateOrder) {
            const dateGames = byDate.get(date)!;

            const lines = [`<b>📅 ${date}</b>`];
            for (const game of dateGames) {
              const loc = [game.venue, game.address].filter(Boolean).join(', ');
              lines.push(`\n🎮 [${game.sourceLabel}] <b>${game.title}</b> ${game.number}\n🕐 ${game.time}${loc ? ` · 📍 ${loc}` : ''}${game.price ? ` · 💰 ${game.price}` : ''}`);
            }

            const buttons = dateGames.map(game => [{
              text: `📊 [${game.sourceLabel}] ${game.title} ${game.number}`.trim(),
              callback_data: `poll:${game.id}`,
            }]);

            await bot.sendMessage(chatId, lines.join('\n'), {
              parse_mode: 'HTML',
              reply_markup: { inline_keyboard: buttons },
            });
          }

          const bySource = sources.map(s => {
            const count = games.filter(g => g.sourceLabel === s.label).length;
            return `[${s.label}]: ${count}`;
          }).join(', ');
          console.log(`[schedule] done — total ${games.length} games. ${bySource}`);
          await bot.sendMessage(chatId, `✅ Показаны все игры: ${games.length} шт. за ${dateOrder.length} дней.\n📊 По источникам: ${bySource}`);
        } catch (err) {
          await bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
          await bot.sendMessage(chatId, `❌ Ошибка: ${(err as Error).message}`);
        }
        return;
      }
    }

    // Handle button presses
    if (update.callback_query) {
      const { id: callbackId, data, message } = update.callback_query;
      if (!data?.startsWith('poll:')) return;

      const gameId = data.slice(5);
      const game = gameCache.get(gameId);

      if (!game) {
        await bot.answerCallbackQuery(callbackId, '❌ Данные устарели. Запустите /schedule заново.');
        return;
      }

      try {
        const question = `[${game.sourceLabel}] ${buildPollQuestion(game)}`;
        await bot.sendPoll(
          groupChatId,
          question.length <= 300 ? question : question.slice(0, 297) + '...',
          POLL_OPTIONS,
          { is_anonymous: false }
        );
        await bot.answerCallbackQuery(callbackId, '✅ Опрос опубликован в группе!');
      } catch (err) {
        await bot.answerCallbackQuery(callbackId, `❌ Ошибка: ${(err as Error).message}`);
      }
    }
  }

  // Attach handler and return
  const originalLaunch = bot.launch.bind(bot);
  bot.launch = async () => {
    await bot.setMyCommands([
      { command: 'schedule', description: 'Показать расписание игр' },
    ]);
    return originalLaunch(handleUpdate);
  };

  return bot;
}
