import { Game } from './parser';

export function formatGameForTelegram(game: Game): string {
  const title = game.number
    ? `<b>${game.title}</b> ${game.number}`
    : `<b>${game.title}</b>`;
  const location = [game.venue, game.address].filter(Boolean).join(', ');
  const lines = [
    title,
    `📅 ${game.date} | 🕐 ${game.time}`,
  ];
  if (location) lines.push(`📍 ${location}`);
  if (game.price) lines.push(`💰 ${game.price}`);
  return lines.join('\n');
}

export function buildPollQuestion(game: Game): string {
  const datetime = [game.date, game.time.replace(/^в\s*/i, '')].filter(Boolean).join(', ');
  const title = `${game.title} ${game.number}`.trim();
  const location = [game.venue, game.address].filter(Boolean).join(', ');
  const question = [datetime, title, location].filter(Boolean).join('\n');
  // Telegram poll question limit is 300 chars
  return question.length <= 300 ? question : question.slice(0, 297) + '...';
}

export function formatSchedule(games: Game[]): string {
  // Group games by date, preserving order of first appearance
  const dateOrder: string[] = [];
  const byDate = new Map<string, Game[]>();

  for (const game of games) {
    if (!byDate.has(game.date)) {
      byDate.set(game.date, []);
      dateOrder.push(game.date);
    }
    byDate.get(game.date)!.push(game);
  }

  const lines: string[] = ['# Расписание игр Quiz Please Саратов', ''];

  for (const date of dateOrder) {
    lines.push(`## ${date}`);
    lines.push('');

    for (const game of byDate.get(date)!) {
      const status = game.available ? '' : ' ~~(sold out)~~';
      lines.push(`### ${game.title} ${game.number}${status}`);
      lines.push(`📅 ${game.date} | 🕐 ${game.time}`);

      const location = [game.venue, game.address].filter(Boolean).join(', ');
      if (location) {
        lines.push(`📍 ${location}`);
      }

      if (game.price) {
        lines.push(`💰 ${game.price}`);
      }


      lines.push('');
    }
  }

  return lines.join('\n');
}
