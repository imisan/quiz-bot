export interface Game {
  id: string;
  number: string;
  title: string;
  date: string;      // "18 марта, Среда"
  time: string;      // "в 19:30"
  dateTime: Date;    // для сортировки при merge
  venue: string;
  address: string;
  price: string;
  available: boolean;
  url: string;
}

export interface GameSource {
  label: string;
  fetchGames(): Promise<Game[]>;
}
