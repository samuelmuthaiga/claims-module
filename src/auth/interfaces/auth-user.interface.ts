export interface AuthUser {
  id: string;
  name?: string;
  email?: string;
  country?: string;
  roles: string[];
  permissions: string[];
}
