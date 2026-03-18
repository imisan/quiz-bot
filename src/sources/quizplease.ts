import { execFile } from 'child_process';
import { promisify } from 'util';
import { Game, GameSource } from '../types';

const execFileAsync = promisify(execFile);

const API_URL = 'https://api.quizplease.ru/api/games/schedule/57?per_page=100&order=date&statuses[]=0&statuses[]=1&statuses[]=2&statuses[]=3&statuses[]=5';

export class QuizPleaseSource implements GameSource {
  readonly label = 'КП';

  async fetchGames(): Promise<Game[]> {
    const { stdout } = await execFileAsync('curl', [
      '-sL',
      '--max-time', '30',
      '-H', 'Accept: application/json',
      '-H', 'Accept-Language: ru-RU,ru;q=0.9',
      API_URL,
    ], { maxBuffer: 10 * 1024 * 1024 });

    const json = JSON.parse(stdout);

    if (json.status !== 'ok') {
      throw new Error(`API вернул ошибку: ${json.status}`);
    }

    return this.parseGames(json.data.data);
  }

  private parseGames(rawGames: any[]): Game[] {
    return rawGames.map(g => {
      const { date, time, dateTime } = this.parseDate(g.date);
      const price = g.price ? `${g.price}₽` : '';
      return {
        id: String(g.id),
        number: g.game_number ? `#${g.game_number}` : '',
        title: g.title ?? '',
        date,
        time,
        dateTime,
        venue: g.place?.title ?? '',
        address: g.place?.address ?? '',
        price,
        available: g.status === 0,
        url: `https://quizplease.ru/game-page?id=${g.id}`,
      };
    });
  }

  private parseDate(dateStr: string): { date: string; time: string; dateTime: Date } {
    // dateStr format: "18.03.2026 19:30"
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('.');
    const [hours, minutes] = timePart.split(':');
    const d = new Date(+year, +month - 1, +day, +hours, +minutes);

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
      dateTime: d,
    };
  }
}
