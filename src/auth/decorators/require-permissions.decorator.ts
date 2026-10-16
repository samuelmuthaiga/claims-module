import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'requiredPermissions';

/** The caller must hold every listed permission. */
export const RequirePermissions = (...permissions: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);
