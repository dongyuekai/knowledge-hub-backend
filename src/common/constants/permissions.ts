import { RoleCode } from './roles';

/** 管理员自动拥有的操作权限 */
export const ADMIN_OPERATION_PERMISSIONS = [
  'document:list',
  'document:create',
  'document:edit',
  'document:delete',
  'document:review',
  'document:category',
  'document:category:query',
  'document:tag',
  'document:version',
  'system:user',
  'system:role',
  'system:permission',
  'system:permission:create',
  'system:permission:edit',
  'system:permission:delete',
  'system:team',
  'system:statistics',
  'system:settings',
] as const;

export const ADMIN_ROLES = [RoleCode.ADMIN] as const;

/** 1 菜单 2 按钮 3 接口 */
export enum PermissionType {
  Menu = 1,
  Button = 2,
  Api = 3,
}
