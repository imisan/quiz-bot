import { Telegraf, Markup } from 'telegraf';
import { fetchScheduleHtml } from './fetcher';
import { parseSchedule, Game } from './parser';
import { formatGameForTelegram, buildPollQuestion } from './formatter';

const POLL_OPTIONS = [
  '✅ Да, иду',
  '❌ Нет, не смогу',
  '🤔 Думаю',
  '🏆 Играю за другую команду',
  '👥 Со мной +1',
];

export function createBot(token: string, groupChatId: string): Telegraf {
  const bot = new Telegraf(token);

  // In-memory cache of games for the current session
  const gameCache = new Map<string, Game>();

  bot.command('start', (ctx) => {
    ctx.reply(
      'Привет! Я бот для расписания Quiz Please Саратов.\n\n' +
      'Команды:\n' +
      '/schedule — показать расписание игр'
    );
  });

  bot.command('schedule', async (ctx) => {
    const statusMsg = await ctx.reply('⏳ Загружаю расписание...');

    try {
      const html = await fetchScheduleHtml();
      const games = parseSchedule(html);

      await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

      if (games.length === 0) {
        await ctx.reply('Игры не найдены.');
        return;
      }

      // Cache games for callback handling
      gameCache.clear();
      for (const game of games) {
        gameCache.set(game.id, game);
      }

      for (const game of games) {
        await ctx.replyWithHTML(
          formatGameForTelegram(game),
          Markup.inlineKeyboard([
            Markup.button.callback('📊 Опубликовать опрос в группу', `poll:${game.id}`),
          ])
        );
      }
    } catch (err) {
      await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
      await ctx.reply(`❌ Ошибка: ${(err as Error).message}`);
    }
  });

  bot.action(/^poll:(.+)$/, async (ctx) => {
    const gameId = ctx.match[1];
    const game = gameCache.get(gameId);

    if (!game) {
      await ctx.answerCbQuery('❌ Данные устарели. Запустите /schedule заново.');
      return;
    }

    try {
      await ctx.telegram.sendPoll(
        groupChatId,
        buildPollQuestion(game),
        POLL_OPTIONS,
        { is_anonymous: false }
      );
      await ctx.answerCbQuery('✅ Опрос опубликован в группе!');
    } catch (err) {
      await ctx.answerCbQuery(`❌ Ошибка: ${(err as Error).message}`);
    }
  });

  return bot;
}
