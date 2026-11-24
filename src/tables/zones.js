// Helpers for writing glass designs.

/** Half-plane of points closer to A than to B (for splitting a window between roses). */
export function closer(A, B) {
  return [2 * (B[0] - A[0]), 2 * (B[1] - A[1]), B[0] ** 2 + B[1] ** 2 - A[0] ** 2 - A[1] ** 2];
}
export const above = (y) => [0, 1, y]; // y <= value
export const below = (y) => [0, -1, -y]; // y >= value
export const leftOf = (x) => [1, 0, x];
export const rightOf = (x) => [-1, 0, -x];
