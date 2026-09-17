import { z } from 'zod';

/**
 * DashScope/Qwen 结构化输出偶发写成 [{...}]。
 * withStructuredOutput 按 object schema 校验时会变成
 * 「expected object, received array」，评估/改写被 catch 成兜底。
 */
export function unwrapStructuredObject(value: unknown): unknown {
  if (Array.isArray(value) && value.length > 0) return value[0];
  return value;
}

export function objectOrFirstItem<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(unwrapStructuredObject, schema);
}
