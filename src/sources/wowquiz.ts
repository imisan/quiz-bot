import { execFile } from 'child_process';
import { promisify } from 'util';
import { Game, GameSource } from '../types';

const execFileAsync = promisify(execFile);

const API_BASE = 'https://api.etowow.ru/games/all?upcoming=1&domain=https:%2F%2Fsaratov.wowquiz.ru&page=';

export class WowQuizSource implements GameSource {
  readonly label = 'WOW';

  async fetchGames(): Promise<Game[]> {
    const firstPage = await this.fetchPage(1);
    const pageCount: number = firstPage.data.pageCount;

    const remaining = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, i) => this.fetchPage(i + 2))
    );

    const allRaw: any[] = [
      ...firstPage.data.games,
      ...remaining.flatMap(r => r.data.games),
    ];

    return allRaw.map(g => this.mapGame(g));
  }

  private async fetchPage(page: number): Promise<any> {
    const { stdout } = await execFileAsync('curl', [
      '-sL',
      '--max-time', '30',
      '-H', 'Accept: application/json',
      '-H', 'Accept-Language: ru-RU,ru;q=0.9',
      API_BASE + page,
    ], { maxBuffer: 10 * 1024 * 1024 });

    const json = JSON.parse(stdout);
    if (json.status !== 'success') {
      throw new Error(`WowQuiz API вернул ошибку: ${json.status}`);
    }
    return json;
  }

  private mapGame(g: any): Game {
    const { date, time, dateTime } = this.parseDate(g.date);
    return {
      id: String(g.id),
      number: '',
      title: g.title ?? '',
      date,
      time,
      dateTime,
      venue: g.bar?.title ?? '',
      address: g.bar?.address ?? '',
      price: g.price ? `${g.price}₽` : '',
      available: g.registration_type === 'open',
      url: `https://saratov.wowquiz.ru/game/${g.code}`,
    };
  }

  // dateStr format: "2026-03-24 19:00:00" — already local time
  private parseDate(dateStr: string): { date: string; time: string; dateTime: Date } {
    const [datePart, timePart] = dateStr.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    const d = new Date(year, month - 1, day, hours, minutes);

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
      time: `в ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      dateTime: d,
    };
  }
}
