import { parse, format } from 'date-fns';

export default function formatDA(date, strFormat = 'MMM D, YYYY') {
  if (!date) {
    return;
  }

  const parsedDateTime = parse(date, 'YYYYMMDD');

  return format(parsedDateTime, strFormat);
}
