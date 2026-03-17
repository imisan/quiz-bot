export interface Game {
  id: string;
  number: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  price: string;
  available: boolean;
  url: string;
}

function parseDate(dateStr: string): { date: string; time: string } {
  // dateStr format: "18.03.2026 19:30"
  const [datePart, timePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('.');
  const d = new Date(+year, +month - 1, +day);

  const parts = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).formatToParts(d);

  const dayVal = parts.find(p => p.type === 'day')?.value ?? '';
  const monthVal = parts.find(p => p.type === 'month')?.value ?? '';
  const weekdayVal = parts.find(p => p.type === 'weekday')?.value ?? '';
  const weekdayCapitalized = weekdayVal.charAt(0).toUpperCase() + weekdayVal.slice(1);

  return {
    date: `${dayVal} ${monthVal}, ${weekdayCapitalized}`,
    time: `в ${timePart}`,
  };
}

export function parseSchedule(rawGames: any[]): Game[] {
  return rawGames.map(g => {
    const { date, time } = parseDate(g.date);
    const price = g.price ? `${g.price}₽` : '';
    return {
      id: String(g.id),
      number: g.game_number ? `#${g.game_number}` : '',
      title: g.title ?? '',
      date,
      time,
      venue: g.place?.title ?? '',
      address: g.place?.address ?? '',
      price,
      available: g.status === 0,
      url: `https://quizplease.ru/game-page?id=${g.id}`,
    };
  });
}
