/**
 * Tetrahedron geometry data for d4 physics die.
 *
 * Vertices form a regular tetrahedron inscribed in a unit sphere,
 * matching the cannon-es ConvexPolyhedron format.
 */

/** Scale factor — visual size of the die (Three.js units) */
export const D4_SCALE = 1.4;

/** Vertices of a regular tetrahedron (unit-ish size) */
export const D4_VERTICES: [number, number, number][] = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
];

/**
 * Face indices — each triple indexes into D4_VERTICES.
 * Winding order is counter-clockwise when viewed from outside
 * (outward-pointing normals).
 */
export const D4_FACES: [number, number, number][] = [
  [0, 1, 2], // face 0
  [0, 2, 3], // face 1
  [0, 3, 1], // face 2
  [1, 3, 2], // face 3 (bottom)
];

/**
 * Outward-pointing normal for each face.
 * Computed as cross(v1-v0, v2-v0) normalized.
 */
export const D4_NORMALS: [number, number, number][] = (() => {
  const v = D4_VERTICES;
  return D4_FACES.map(([a, b, c]) => {
    const ax = v[b][0] - v[a][0];
    const ay = v[b][1] - v[a][1];
    const az = v[b][2] - v[a][2];
    const bx = v[c][0] - v[a][0];
    const by = v[c][1] - v[a][1];
    const bz = v[c][2] - v[a][2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    return [nx / len, ny / len, nz / len] as [number, number, number];
  });
})();

/**
 * Map face index → d4 result (1–4).
 * The result shown is the number on the face pointing DOWN
 * (the face resting on the table), which is standard d4 convention.
 */
export const D4_FACE_RESULTS: Record<number, number> = {
  0: 1,
  1: 2,
  2: 3,
  3: 4,
};
