import { parse, format } from 'date-fns';

export default function formatTM(time, strFormat = 'HH:mm:ss') {
  if (!time) {
    return;
  }

  try {
    const inputFormat = 'HHmmss.SSS';
    const strTime = time.toString().substring(0, inputFormat.length);
    const parsedDateTime = parse(strTime, 'HHmmss.SSS', new Date(0));
    const formattedDateTime = format(parsedDateTime, strFormat);

    return formattedDateTime;
  } catch (err) {
    // swallow?
  }

  return format(parsedDateTime, strFormat);
}
