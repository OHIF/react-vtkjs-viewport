export default function dispatchEvent(eventWindow, eventName, detail) {
  const customEvent = new CustomEvent(eventName, {
    detail,
  });

  eventWindow.dispatchEvent(customEvent);
}
