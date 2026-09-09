import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { RoleService } from './role.service';
import { PermissionService } from './permission.service';
import { UserController } from './user.controller';
import { RoleController } from './role.controller';
import { PermissionController } from './permission.controller';
import { UserEntity } from './entities/user.entity';
import { RoleEntity } from './entities/role.entity';
import { UserRoleEntity } from './entities/user-role.entity';
import { PermissionEntity } from './entities/permission.entity';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { UserPermissionEntity } from './entities/user-permission.entity';
import { DocumentEntity } from '../document/entities/document.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      RoleEntity,
      UserRoleEntity,
      PermissionEntity,
      RolePermissionEntity,
      UserPermissionEntity,
      DocumentEntity,
    ]),
  ],
  controllers: [UserController, RoleController, PermissionController],
  providers: [UserService, RoleService, PermissionService],
  exports: [UserService, RoleService, PermissionService],
})
export class UserModule {}
