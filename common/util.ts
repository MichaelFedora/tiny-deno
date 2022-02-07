export function wait(time: number) {
  return new Promise<void>(res => setTimeout(res, time));
}
