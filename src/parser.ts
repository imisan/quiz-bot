import { load } from 'cheerio';

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

export function parseSchedule(html: string): Game[] {
  const $ = load(html);
  const games: Game[] = [];

  $('.schedule-column').each((_i, el) => {
    const column = $(el);
    const id = column.attr('id') ?? '';

    const date = column.find('.block-date-with-language-game').text().trim();
    const title = column.find('.h2-game-card.h2-left').text().trim();
    const number = column.find('.h2-game-card').not('.h2-left').first().text().trim();
    // Extract only the direct text node of .schedule-block-info-bar (skip button children)
    const venueEl = column.find('.schedule-block-info-bar');
    venueEl.find('button').remove();
    const venue = venueEl.text().trim();
    const address = column.find('.techtext-halfwhite').first().text().replace(/Где это\?/g, '').trim();

    // Time is in the second .schedule-info block
    const timeBlock = column.find('.schedule-info').eq(1);
    const time = timeBlock.find('.techtext').first().text().trim();

    const price = column.find('.price').text().trim();
    const available = column.find('.schedule-block').hasClass('available');
    const url = column.find('a[href*="game-page?id="]').first().attr('href') ?? '';

    if (title && date) {
      games.push({ id, number, title, date, time, venue, address, price, available, url });
    }
  });

  return games;
}
