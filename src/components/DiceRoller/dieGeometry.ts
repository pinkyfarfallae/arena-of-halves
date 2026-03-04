import * as THREE from 'three';

/* ── Edge transform (identical across all die types) ── */

export function edgeTransform(
  a: THREE.Vector3Tuple,
  b: THREE.Vector3Tuple,
): { pos: THREE.Vector3; quat: THREE.Quaternion } {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const dir = vb.clone().sub(va).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return { pos: mid, quat };
}

/* ── Edge cylinder with vertex-color tint ── */

export interface EdgeCylinderOptions {
  minY: number;
  maxY: number;
  /** Base brightness added to the tint ramp. Default 0.5 */
  tintBase?: number;
  /** Radial segments for CylinderGeometry. Default 8 */
  segments?: number;
}

export function makeEdgeCylinder(
  a: THREE.Vector3Tuple,
  b: THREE.Vector3Tuple,
  radius: number,
  baseColor: THREE.Color,
  opts: EdgeCylinderOptions,
): THREE.CylinderGeometry {
  const { minY, maxY, tintBase = 0.5, segments = 8 } = opts;
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const height = va.distanceTo(vb);
  const geo = new THREE.CylinderGeometry(radius, radius, height, segments, 1);

  const range = maxY - minY || 1;
  const tA = (a[1] - minY) / range;
  const tB = (b[1] - minY) / range;
  const positions = geo.attributes.position;
  const colors = new Float32Array(positions.count * 3);

  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const along = (y + height / 2) / height;
    const tint = tintBase + 0.45 * (tA + (tB - tA) * along);
    colors[i * 3] = baseColor.r * tint;
    colors[i * 3 + 1] = baseColor.g * tint;
    colors[i * 3 + 2] = baseColor.b * tint;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/* ── Triangle face geometry (D4, D8, D10, D20) ── */

export function makeTriangleFaceGeo(
  verts: THREE.Vector3Tuple[],
  normal: THREE.Vector3,
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array([...verts[0], ...verts[1], ...verts[2]]);
  const norms = new Float32Array([
    normal.x, normal.y, normal.z,
    normal.x, normal.y, normal.z,
    normal.x, normal.y, normal.z,
  ]);
  const uvs = new Float32Array([0.5, 1.0, 0.0, 0.0, 1.0, 0.0]);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(norms, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
}
