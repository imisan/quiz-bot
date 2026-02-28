import * as fs from 'fs';
import * as path from 'path';
import { fetchScheduleHtml } from './fetcher';
import { parseSchedule } from './parser';
import { formatSchedule } from './formatter';

async function main() {
  const useLocal = process.argv.includes('--local');

  const html = useLocal
    ? fs.readFileSync(path.join(__dirname, '..', 'data', 'Расписание игр.html'), 'utf-8')
    : await fetchScheduleHtml();

  const games = parseSchedule(html);
  const markdown = formatSchedule(games);

  console.log(markdown);
  console.error(`\nПарсинг завершён: найдено ${games.length} игр.`);
}

main().catch((err) => {
  console.error('Ошибка:', err.message);
  process.exit(1);
});
