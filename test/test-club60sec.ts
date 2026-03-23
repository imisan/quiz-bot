import * as fs from 'fs';
import * as path from 'path';
import { Club60SecSource } from '../src/sources/club60sec';

const html = fs.readFileSync(path.join(__dirname, 'club60sec-sample.html'), 'utf-8');

// Access private method for testing
const source = new Club60SecSource() as any;
const games = source.parseGames(html);

console.log(`Найдено игр: ${games.length}\n`);
for (const g of games) {
  console.log(JSON.stringify(g, null, 2));
  console.log('---');
}
