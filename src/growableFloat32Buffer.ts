/**
 * Append-only Float32 storage that grows by powers of two when full.
 */
export class GrowableFloat32Buffer {
  private data: Float32Array<ArrayBuffer>;

  /** Number of floats written into {@link array}. */
  used = 0;

  constructor(initialCapacityFloats: number) {
    this.data = new Float32Array(initialCapacityFloats);
  }

  reset() {
    this.used = 0;
  }

  get array(): Float32Array<ArrayBuffer> {
    return this.data;
  }

  ensureRoom(additionalFloats: number) {
    if (this.used + additionalFloats > this.data.length) {
      this.data = GrowableFloat32Buffer.grow(this.data, this.used, additionalFloats);
    }
  }

  /** Independent copy of the used prefix (empty array if nothing written). */
  copyUsed(): Float32Array {
    if (this.used === 0) {
      return new Float32Array(0);
    }
    return new Float32Array(this.data.subarray(0, this.used));
  }

  private static grow(
    buf: Float32Array,
    used: number,
    needFloats: number
  ): Float32Array<ArrayBuffer> {
    const minLen = used + needFloats;
    let nextLen = buf.length;
    while (nextLen < minLen) {
      nextLen = nextLen === 0 ? minLen : nextLen * 2;
    }
    const ab = new ArrayBuffer(nextLen * Float32Array.BYTES_PER_ELEMENT);
    const next = new Float32Array(ab);
    if (used > 0) {
      next.set(buf.subarray(0, used));
    }
    return next;
  }
}
