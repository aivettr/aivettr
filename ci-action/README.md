# aivettr-action（CI 集成，骨架）

GitHub Action 形态的 AIVettr 扫描。**定位：CLI 的薄包装** —— 仅做 inputs 映射与 `aivettr scan` 调用、SARIF 上传等胶水，检测逻辑全部在 `@aivettr/scanner-core`；本目录可整体裁撤（退回仅 CLI 形态）。

构建产物 `dist/index.js` 待 CLI 实现后接入（actions/toolkit）。
