import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const SCHEDULE_URL = 'https://saratov.quizplease.ru/schedule';

export async function fetchScheduleHtml(): Promise<string> {
  const { stdout } = await execFileAsync('curl', [
    '-sL',
    '--max-time', '30',
    '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '-H', 'Accept-Language: ru-RU,ru;q=0.9',
    SCHEDULE_URL,
  ], { maxBuffer: 10 * 1024 * 1024 });

  if (!stdout.includes('schedule-column')) {
    throw new Error('Не удалось получить расписание: страница не содержит данных игр (возможно, сработала капча)');
  }

  return stdout;
}
