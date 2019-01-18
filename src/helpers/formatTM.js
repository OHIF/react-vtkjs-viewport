import moment from 'moment';

export default function formatTM(time, format = 'HH:mm:ss') {
  if (!time) {
    return;
  }

  // DICOM Time is stored as HHmmss.SSS, where:
  //      HH 24 hour time:
  //      m mm    0..59   Minutes
  //      s ss    0..59   Seconds
  //      S SS SSS    0..999  Fractional seconds
  //
  // See MomentJS: http://momentjs.com/docs/#/parsing/string-format/
  const dateTime = moment(time, 'HHmmss.SSS');

  return dateTime.format(format);
}
