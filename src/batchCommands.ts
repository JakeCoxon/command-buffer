import type { PackedKey } from "./drawPacket";

/**
 * Generic batcher: island runs (contiguous) → stable-bucket by orderHint → stable-bucket by batch.
 * Backend-agnostic; only uses key fields. Policy (key construction) lives in the adapter.
 *
 * Invariants:
 * - **Islands**: Contiguous runs only. If the stream is island 0, 1, 0, we get three blocks (we do not merge the two island-0 runs).
 * - **OrderHint / batch**: Bucket-based stable grouping within each island run. All packets with the same orderHint in that island are batched together (in order of first appearance of orderHint), then within each orderHint bucket we stable-group by batch. So interleaved orderHints (0, 1, 0, 1) become buckets 0(…), 1(…), giving real batching instead of four tiny runs.
 *
 * No .slice(); we operate on index ranges and push packets directly into group arrays.
 *
 * @param packets - Array of draw packets (e.g. DrawPacket)
 * @param keys - PackedKey for each packet (same length as packets)
 * @returns Array of groups; each group is packets with same batch within same orderHint bucket within same island run
 */
export function batchCommands<T>(packets: T[], keys: PackedKey[]): T[][] {
  if (packets.length === 0) return [];
  if (packets.length !== keys.length) {
    throw new Error(`batchCommands: packets.length (${packets.length}) !== keys.length (${keys.length})`);
  }

  const out: T[][] = [];
  let i = 0;

  while (i < packets.length) {
    const island = keys[i].island;

    // Collect one island run (contiguous)
    let j = i;
    while (j < packets.length && keys[j].island === island) j++;

    // Within [i, j): stable-bucket by orderHint, then by batch (no slicing)
    const orderMap = new Map<
      number,
      { batches: Map<number, T[]>; batchOrder: number[] }
    >();
    const orderOrder: number[] = [];

    for (let k = i; k < j; k++) {
      const o = keys[k].orderHint;
      let entry = orderMap.get(o);
      if (!entry) {
        entry = { batches: new Map(), batchOrder: [] };
        orderMap.set(o, entry);
        orderOrder.push(o);
      }

      const b = keys[k].batch;
      let g = entry.batches.get(b);
      if (!g) {
        g = [];
        entry.batches.set(b, g);
        entry.batchOrder.push(b);
      }
      g.push(packets[k]);
    }

    // Emit in stable orderHint order, then stable batch order
    for (const o of orderOrder) {
      const entry = orderMap.get(o)!;
      for (const b of entry.batchOrder) {
        out.push(entry.batches.get(b)!);
      }
    }

    i = j;
  }

  return out;
}
