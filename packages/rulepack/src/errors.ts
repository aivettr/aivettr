/** 规则装载错误（CLI 映射退出码 2） */
export class RuleLoadError extends Error {
  constructor(
    message: string,
    readonly source?: string,
  ) {
    super(source ? `${source}: ${message}` : message);
    this.name = "RuleLoadError";
  }
}
