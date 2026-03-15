export function start(): void {
  // Minimal bootstrap for process startup.
  console.info("goals-tracker-bot bootstrap started");
}

if (require.main === module) {
  start();
}
