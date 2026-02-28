import * as fs from 'fs';
import * as path from 'path';
import { parseSchedule } from './parser';
import { formatSchedule } from './formatter';

const htmlPath = path.join(__dirname, '..', 'data', 'Расписание игр.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

const games = parseSchedule(html);
const markdown = formatSchedule(games);

console.log(markdown);
console.error(`\nПарсинг завершён: найдено ${games.length} игр.`);
