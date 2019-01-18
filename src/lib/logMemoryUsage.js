export function logMemoryUsage() {
  if (!window.performance || !window.performance.memory) {
    return;
  }

  const memory = window.performance.memory;
  const kb = 1024;
  const mb = kb * kb;

  console.log(
    'total %d KB %d MB',
    memory.totalJSHeapSize / kb,
    memory.totalJSHeapSize / mb
  );
  console.log(
    'used %d KB %d MB',
    memory.usedJSHeapSize / kb,
    memory.usedJSHeapSize / mb
  );
  console.log(
    'limit %d KB %d MB',
    memory.jsHeapSizeLimit / kb,
    memory.jsHeapSizeLimit / mb
  );
}
