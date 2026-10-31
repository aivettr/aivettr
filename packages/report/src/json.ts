/**
 * JSON 渲染器：schemaVersion 1.0。
 * 契约：1.x 只增字段不破坏；破坏性变更走 2.0。
 * 字段顺序由 ScanResult 构造顺序固定，保证确定性。
 */

import type { ScanResult } from "@aivettr/scanner-core";

export function renderJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2) + "\n";
}
