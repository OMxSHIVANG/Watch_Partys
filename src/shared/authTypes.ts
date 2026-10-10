export interface User {
  id: string;
  email: string;
  displayName: string;
  username?: string;
  avatar?: string;
  bio?: string;
  provider: 'email' | 'google';
  createdAt: number;
}



