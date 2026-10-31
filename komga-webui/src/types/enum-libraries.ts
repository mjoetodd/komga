export enum SeriesCoverDto {
  FIRST = 'FIRST',
  FIRST_UNREAD_OR_FIRST = 'FIRST_UNREAD_OR_FIRST',
  FIRST_UNREAD_OR_LAST = 'FIRST_UNREAD_OR_LAST',
  LAST = 'LAST',
}

export enum BookPosterSourceDto {
  BOOK = 'BOOK',
  SERIES = 'SERIES',
}

export enum ScanIntervalDto {
  DISABLED = 'DISABLED',
  HOURLY = 'HOURLY',
  EVERY_6H = 'EVERY_6H',
  EVERY_12H = 'EVERY_12H',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
}
