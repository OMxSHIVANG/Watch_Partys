import { User } from '../../shared/authTypes';
import { UserModel } from '../db/models/User';

export class AuthService {
  

  public async upsertGoogleUser(googleId: string, email: string, displayName: string, avatar?: string): Promise<User> {
    const key = email.toLowerCase();
    let stored = await UserModel.findOne({ email: key });
    
    if (stored) {
      stored.displayName = displayName;
      if (avatar) stored.avatar = avatar;
      if (googleId && !stored.googleId) stored.googleId = googleId;
      if (!stored.username) {
        const baseUsername = displayName.toLowerCase().replace(/[^a-z0-9]/g, '') || email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        stored.username = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
      }
      await stored.save();
      return stored.toJSON() as unknown as User;
    }
    
    const baseUsername = displayName.toLowerCase().replace(/[^a-z0-9]/g, '') || email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const username = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
    
    const userDoc = await UserModel.create({
      email: key,
      displayName,
      username,
      avatar,
      provider: 'google',
      googleId
    });
    
    return userDoc.toJSON() as unknown as User;
  }

  public async findUserByEmail(email: string): Promise<User | null> {
    const stored = await UserModel.findOne({ email: email.toLowerCase() });
    return stored ? stored.toJSON() as unknown as User : null;
  }
}
