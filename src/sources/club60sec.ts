import { execFile } from 'child_process';
import { promisify } from 'util';
import { Game, GameSource } from '../types';

const execFileAsync = promisify(execFile);

const SITE_URL = 'https://club60sec.ru/city/saratov';

export class Club60SecSource implements GameSource {
  readonly label = '60 сек';

  async fetchGames(): Promise<Game[]> {
    const { stdout } = await execFileAsync('curl', [
      '-sL',
      '--max-time', '30',
      '-H', 'Accept: text/html',
      '-H', 'Accept-Language: ru-RU,ru;q=0.9',
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      SITE_URL,
    ], { maxBuffer: 10 * 1024 * 1024 });

    return this.parseGames(stdout);
  }

  private parseGames(html: string): Game[] {
    // Split by game div start tags; first element is content before any game
    const chunks = html.split(/<div class="game[^"]*"\s+data-format/);
    chunks.shift();

    const games: Game[] = [];
    for (const chunk of chunks) {
      const game = this.parseGameChunk(chunk);
      if (game) games.push(game);
    }
    return games;
  }

  private parseGameChunk(chunk: string): Game | null {
    const idMatch = chunk.match(/id=(\d+)/);
    const nameMatch = chunk.match(/data-name>([\s\S]*?)<\/div>/);
    const tsMatch = chunk.match(/data-game-timestamp>(\d+)<\/div>/);
    const dateTextMatch = chunk.match(/data-date>([\s\S]*?)<\/div>/);
    const locationMatch = chunk.match(/data-location>([\s\S]*?)<\/div>/);
    const priceMatch = chunk.match(/game__data-item--price[\s\S]*?<span>([\s\S]*?)<\/span>/);
    const available = /game__sign-up/.test(chunk);

    if (!idMatch || !nameMatch || !tsMatch || !dateTextMatch) return null;

    const id = idMatch[1];
    const title = nameMatch[1].trim();
    const timestamp = parseInt(tsMatch[1], 10);

    // Parse date/time from data-date text to avoid timezone issues.
    // Format: "24 марта, вт, 19:00"
    // Year comes from the UTC timestamp (year is unambiguous in UTC).
    const year = new Date(timestamp * 1000).getUTCFullYear();
    const { date, time, dateTime } = this.parseDateText(dateTextMatch[1].trim(), year);

    const locationRaw = locationMatch ? locationMatch[1].trim() : '';
    const { venue, address } = this.parseLocation(locationRaw);

    const priceRaw = priceMatch ? priceMatch[1].trim() : '';
    const price = this.parsePrice(priceRaw);

    return { id, number: '', title, date, time, dateTime, venue, address, price, available, url: SITE_URL };
  }

  // "Чикаго 2.0 (ул.Чапаева, 68/70)" → { venue: "Чикаго 2.0", address: "ул.Чапаева, 68/70" }
  private parseLocation(location: string): { venue: string; address: string } {
    const m = location.match(/^(.+?)\s*\((.+)\)$/);
    if (m) return { venue: m[1].trim(), address: m[2].trim() };
    return { venue: location, address: '' };
  }

  // "600 ₽ с человека" → "600₽"
  private parsePrice(raw: string): string {
    const m = raw.match(/(\d[\d\s]*)\s*₽/);
    if (!m) return '';
    return m[1].replace(/\s/g, '') + '₽';
  }

  private static readonly MONTHS: Record<string, number> = {
    'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4,
    'мая': 5, 'июня': 6, 'июля': 7, 'августа': 8,
    'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12,
  };

  // dateText format: "24 марта, вт, 19:00"
  private parseDateText(dateText: string, year: number): { date: string; time: string; dateTime: Date } {
    const m = dateText.match(/^(\d+)\s+(\S+),\s*\S+,\s*(\d+):(\d+)/);
    if (!m) throw new Error(`Club60Sec: не удалось разобрать дату: "${dateText}"`);

    const day = parseInt(m[1], 10);
    const monthName = m[2];
    const hours = parseInt(m[3], 10);
    const minutes = parseInt(m[4], 10);
    const month = Club60SecSource.MONTHS[monthName];
    if (!month) throw new Error(`Club60Sec: неизвестный месяц: "${monthName}"`);

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
