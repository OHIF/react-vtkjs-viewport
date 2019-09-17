export function createSub(sub) {
  let s = sub;
  const unsubscribe = () => {
    if (s) {
      s.unsubscribe();
      s = null;
    }
  };
  return {
    sub(newSub) {
      unsubscribe();
      s = newSub;
    },
    unsubscribe,
  };
}
