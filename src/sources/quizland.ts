import { execFile } from 'child_process';
import { promisify } from 'util';
import { Game, GameSource } from '../types';

const execFileAsync = promisify(execFile);

const PAGE_URL = 'https://quizland.ru/register';

const MONTHS: Record<string, number> = {
  'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4,
  'мая': 5, 'июня': 6, 'июля': 7, 'августа': 8,
  'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12,
};

export class QuizLandSource implements GameSource {
  readonly label = 'QuizLand';

  async fetchGames(): Promise<Game[]> {
    const { stdout } = await execFileAsync('curl', [
      '-sL',
      '--max-time', '30',
      '-H', 'Accept: text/html',
      '-H', 'Accept-Language: ru-RU,ru;q=0.9',
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      PAGE_URL,
    ], { maxBuffer: 10 * 1024 * 1024 });

    // li_variants is HTML-encoded and values are \uXXXX-escaped
    const match = stdout.match(/li_variants&quot;:&quot;([\s\S]*?)&quot;(?:,|&quot;)/);
    if (!match) return [];

    // Decode JSON Unicode escapes (\uXXXX) and \n escape sequences
    const decoded: string = JSON.parse('"' + match[1] + '"');

    // Normalize non-breaking spaces to regular spaces before splitting
    const normalized = decoded.replace(/\u00a0/g, ' ');

    const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
    return lines.map(line => this.parseLine(line)).filter((g): g is Game => g !== null);
  }

  // Format: "TITLE – DD месяц в HH:MM – Venue – NNN руб."
  // Separator is en dash (–, U+2013) with spaces
  private parseLine(line: string): Game | null {
    const parts = line.split(' \u2013 ');
    if (parts.length < 4) return null;

    const [titleRaw, dateTimeRaw, venueRaw, priceRaw] = parts;
    const title = titleRaw.trim();

    const numMatch = title.match(/№(\d+)/);
    const number = numMatch ? `#${numMatch[1]}` : '';

    // "29 марта в 19:00"
    const dtMatch = dateTimeRaw.trim().match(/^(\d+)\s+(\S+)\s+в\s+(\d+):(\d+)$/);
    if (!dtMatch) return null;
    const [, dayStr, monthName, hoursStr, minutesStr] = dtMatch;

    const monthNum = MONTHS[monthName.toLowerCase()];
    if (!monthNum) return null;

    const day = parseInt(dayStr, 10);
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    const now = new Date();
    let year = now.getFullYear();
    const d = new Date(year, monthNum - 1, day, hours, minutes);
    if (d < now) d.setFullYear(++year);

    const { date, time } = this.formatDate(d, hours, minutes);

    // "500 руб." → "500₽"
    const price = priceRaw.trim().replace(/\s*руб\.?$/, '₽');

    const venue = venueRaw.trim();

    return {
      id: `quizland-${title}-${dateTimeRaw.trim()}`,
      number,
      title,
      date,
      time,
      dateTime: d,
      venue,
      address: venue,
      price,
      available: true,
      url: PAGE_URL,
    };
  }

  private formatDate(d: Date, hours: number, minutes: number): { date: string; time: string } {
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
    };
  }
}
