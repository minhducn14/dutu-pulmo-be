import { SetMetadata } from '@nestjs/common';

/**
 * Dùng @Roles('ADMIN') hoặc @Roles('PATIENT') hoặc @Roles('DOCTOR')
 * để đánh dấu các route cần quyền truy cập.
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
