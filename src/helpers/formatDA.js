import { parse, format } from 'date-fns';

export default function formatDA(date, strFormat = 'MMM D, YYYY') {
  if (!date) {
    return;
  }

  try {
    const parsedDateTime = parse(date, 'yyyyMMdd', new Date());
    const formattedDateTime = format(parsedDateTime, strFormat);

    return formattedDateTime;
  } catch (err) {
    // swallow?
  }
}
