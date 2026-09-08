/** 用户对外展示（不含 password） */
export class UserVO {
  id: string;
  username: string;
  email?: string | null;
  realName?: string | null;
  avatar?: string | null;
  status: number;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roleCodes: string[];
}
