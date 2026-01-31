import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

/**
 * Dùng @Roles(RoleEnum.ADMIN) hoặc @Roles('PATIENT') hoặc @Roles('DOCTOR')
 * để đánh dấu các route cần quyền truy cập.
 */
export const Roles = (...roles: string[]) => {
  return applyDecorators(
    SetMetadata('roles', roles),
    ApiExtension('x-roles', roles),
  );
};
