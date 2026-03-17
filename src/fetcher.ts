import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const API_URL = 'https://api.quizplease.ru/api/games/schedule/57?per_page=100&order=date&statuses[]=0&statuses[]=1&statuses[]=2&statuses[]=3&statuses[]=5';

export async function fetchScheduleGames(): Promise<any[]> {
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

  return json.data.data;
}
