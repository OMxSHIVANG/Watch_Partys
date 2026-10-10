import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from './AuthService';

if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is missing.');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = '7d';

const authService = new AuthService();
const googleClient = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID);

export const getJwtSecret = () => JWT_SECRET;

function issueToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function createAuthRouter(): Router {
  const router = Router();

  
  router.post('/google', async (req: Request, res: Response) => {
    const { credential } = req.body as { credential: string };
    if (!credential) {
      res.status(400).json({ success: false, message: 'Google credential missing.' });
      return;
    }

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      
      if (!payload) throw new Error('Invalid token payload');

      const { sub: googleId, email, name: displayName, picture: avatar } = payload;
      if (!email) throw new Error('Email not in token');

      const user = await authService.upsertGoogleUser(googleId, email, displayName || email.split('@')[0], avatar);
      const token = issueToken(user.id, user.email);
      res.json({ success: true, token, user });
    } catch (err) {
      console.error('[Auth] Google token error:', err);
      res.status(400).json({ success: false, message: 'Google sign-in failed. Please try again.' });
    }
  });

  
  router.get('/me', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'No token provided.' });
      return;
    }
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      const user = await authService.findUserByEmail(decoded.email);
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found.' });
        return;
      }
      res.json({ success: true, user });
    } catch {
      res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }
  });

  return router;
}
