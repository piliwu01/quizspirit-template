export const CAPTURE_SUCCESS_RATE = 0.92;
export function canCapture(hp, maxHp) {
  return Number.isFinite(hp) && Number.isFinite(maxHp) && maxHp > 0 && hp > 0 && hp * 20 <= maxHp;
}
export function captureSucceeds(hp, maxHp, random = Math.random) {
  return canCapture(hp, maxHp) && random() < CAPTURE_SUCCESS_RATE;
}
