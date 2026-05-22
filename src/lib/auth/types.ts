export interface AppUser {
  id: string;
  loginId: string;
  memberId: string;
  displayName: string;
}

export interface AuthSession {
  user: AppUser;
  savedAt: string;
}
