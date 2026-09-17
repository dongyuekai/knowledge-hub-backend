import { z } from 'zod';
import {
  objectOrFirstItem,
  unwrapStructuredObject,
} from './structured-output.util';

const gradeSchema = z.object({
  relevant: z.boolean(),
  reason: z.string(),
});

describe('unwrapStructuredObject', () => {
  it('takes the first item when the model wraps the object in an array', () => {
    expect(
      unwrapStructuredObject([{ relevant: true, reason: '资料切题' }]),
    ).toEqual({ relevant: true, reason: '资料切题' });
  });

  it('leaves a plain object unchanged', () => {
    expect(
      unwrapStructuredObject({ relevant: false, reason: '不切题' }),
    ).toEqual({ relevant: false, reason: '不切题' });
  });
});

describe('objectOrFirstItem', () => {
  const schema = objectOrFirstItem(gradeSchema);

  it('parses the wrapped array that caused 检索评估失败', () => {
    expect(
      schema.parse([{ relevant: true, reason: '同一主题，能支撑作答' }]),
    ).toEqual({ relevant: true, reason: '同一主题，能支撑作答' });
  });

  it('still parses a normal object', () => {
    expect(schema.parse({ relevant: false, reason: '主题不同' })).toEqual({
      relevant: false,
      reason: '主题不同',
    });
  });
});
