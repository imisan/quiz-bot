import { spawn } from 'child_process';

function curlPost(url: string, body: string, maxTime = 15): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('curl', [
      '-sS',
      '--max-time', String(maxTime),
      '--connect-timeout', '10',
      '-X', 'POST',
      '-H', 'Content-Type: application/json',
      '--data-binary', '@-',
      url,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString('utf8'); });
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString('utf8'); });
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(stderr.trim() || `curl exited with code ${code}`));
      else resolve(stdout);
    });
    proc.stdin.write(body, 'utf8');
    proc.stdin.end();
  });
}

async function curlPostWithRetry(url: string, body: string, maxTime = 15): Promise<string> {
  const delays = [0, 2000, 5000];
  let lastError: Error = new Error('unknown');
  for (const delay of delays) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    try {
      return await curlPost(url, body, maxTime);
    } catch (err) {
      lastError = err as Error;
    }
  }
  throw lastError;
}

// Minimal Telegram types
export interface Chat { id: number; type: string; }
export interface Message { message_id: number; chat: Chat; text?: string; }
export interface CallbackQuery { id: string; data?: string; message?: Message; }
export interface Update { update_id: number; message?: Message; callback_query?: CallbackQuery; }
export interface InlineKeyboardButton { text: string; callback_data: string; }
export interface InlineKeyboardMarkup { inline_keyboard: InlineKeyboardButton[][]; }

export class TelegramBot {
  private offset = 0;
  private running = false;
  private readonly apiUrl: string;

  constructor(private readonly token: string) {
    this.apiUrl = `https://api.telegram.org/bot${token}`;
  }

  async callApi<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const body = JSON.stringify(params);
    // getUpdates uses long-polling (up to 10s), other calls get standard timeout
    const maxTime = method === 'getUpdates' ? 15 : 15;
    const stdout = await curlPostWithRetry(`${this.apiUrl}/${method}`, body, maxTime);
    const result = JSON.parse(stdout);
    if (!result.ok) {
      throw new Error(`Telegram API [${method}]: ${result.description ?? 'unknown error'}`);
    }
    return result.result as T;
  }

  async sendMessage(
    chatId: number | string,
    text: string,
    options: { parse_mode?: string; reply_markup?: InlineKeyboardMarkup } = {}
  ): Promise<Message> {
    return this.callApi('sendMessage', { chat_id: chatId, text, ...options });
  }

  async deleteMessage(chatId: number | string, messageId: number): Promise<void> {
    await this.callApi('deleteMessage', { chat_id: chatId, message_id: messageId });
  }

  async sendPoll(
    chatId: number | string,
    question: string,
    pollOptions: string[],
    extra: Record<string, unknown> = {}
  ): Promise<Message> {
    return this.callApi('sendPoll', {
      chat_id: chatId,
      question,
      options: pollOptions,
      ...extra,
    });
  }

  async setMyCommands(commands: Array<{ command: string; description: string }>): Promise<void> {
    await this.callApi('setMyCommands', { commands });
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    await this.callApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {}),
    });
  }

  async launch(handler?: (update: Update) => Promise<void>): Promise<void> {
    this.running = true;
    console.log('Бот запущен. Нажмите Ctrl+C для остановки.');

    while (this.running) {
      try {
        const updates = await this.callApi<Update[]>('getUpdates', {
          offset: this.offset,
          timeout: 10,
          allowed_updates: ['message', 'callback_query'],
        });

        for (const update of updates) {
          this.offset = update.update_id + 1;
          if (handler) {
            handler(update).catch((err) => console.error('Ошибка обработки update:', err.message));
          }
        }
      } catch (err) {
        console.error('Ошибка polling:', (err as Error).message);
        await new Promise((r) => setTimeout(r, 3000)); // pause before retry
      }
    }
  }

  stop(): void {
    this.running = false;
  }
}
