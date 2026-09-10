export type Euler = { yaw: number; pitch: number; roll: number };

export function matrixToEuler(data: number[]): Euler {
  const at = (index: number): number => data[index] ?? 0;

  const r00 = at(0);
  const r10 = at(1);
  const r20 = at(2);
  const r21 = at(6);
  const r22 = at(10);

  const pitch = Math.atan2(r21, r22);
  const yaw = Math.atan2(-r20, Math.hypot(r21, r22));
  const roll = Math.atan2(r10, r00);

  const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

  return {
    yaw: toDegrees(yaw),
    pitch: toDegrees(pitch),
    roll: toDegrees(roll),
  };
}
