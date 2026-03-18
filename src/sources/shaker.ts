import { execFile } from 'child_process';
import { promisify } from 'util';
import { Game, GameSource } from '../types';

const execFileAsync = promisify(execFile);

const SITE_URL = 'https://saratov.shakerquiz.ru/';

export class ShakerQuizSource implements GameSource {
  readonly label = 'Шейкер';

  async fetchGames(): Promise<Game[]> {
    const { stdout } = await execFileAsync('curl', [
      '-sL',
      '--max-time', '30',
      '-H', 'Accept: text/html',
      '-H', 'Accept-Language: ru-RU,ru;q=0.9',
      SITE_URL,
    ], { maxBuffer: 10 * 1024 * 1024 });

    const m = stdout.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) throw new Error('ShakerQuiz: __NEXT_DATA__ не найден на странице');

    const nextData = JSON.parse(m[1]);
    const store: [string, any][] = nextData.props.pageProps.store;

    const storeMap = new Map(store);
    const rawGames: any[] = storeMap.get('GET/games/search') ?? [];
    const rawVenues: any[] = storeMap.get('GET/games/venue/:venue/search') ?? [];

    // venue lookup by game_id
    const venueByGameId = new Map<string, any>();
    for (const v of rawVenues) {
      venueByGameId.set(v.game_id, v);
    }

    return rawGames.map(g => {
      const venue = venueByGameId.get(g.id);
      return this.mapGame(g, venue);
    });
  }

  private mapGame(g: any, venue: any): Game {
    const { date, time, dateTime } = this.parseEventTime(g.event_time);
    const price = g.price ? `${g.price}₽` : '';

    const venueName: string = venue?.name ?? '';
    const street: string = venue?.street?.trim() ?? '';
    // street often starts with "VenueName, " — strip that prefix to avoid duplication
    const streetClean = venueName && street.startsWith(venueName + ',')
      ? street.slice(venueName.length + 1).trim()
      : street;
    const address = [streetClean, venue?.house_number].filter(Boolean).join(', ');

    return {
      id: String(g.id),
      number: g.number ? `#${g.number}` : '',
      title: g.name ?? '',
      date,
      time,
      dateTime,
      venue: venueName,
      address,
      price,
      available: g.status === 'Publish',
      url: `https://saratov.shakerquiz.ru/#games`,
    };
  }

  // event_time is stored as "2026-03-18T19:00:00.000Z" where the Z is incorrect —
  // the value is already local Saratov time (UTC+3). Parse the raw hours/minutes directly.
  private parseEventTime(eventTime: string): { date: string; time: string; dateTime: Date } {
    const withoutZ = eventTime.replace('Z', '');
    const [datePart, timePart] = withoutZ.split('T');
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
