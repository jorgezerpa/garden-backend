import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;

export interface AuthRequest extends Request {
  user?: {
    id: number;
    companyId: number;
    role: string;
  };
}

export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Format: "Bearer <token>"

    jwt.verify(token, JWT_SECRET, (err, payload: any) => {
      if (err) {
        return res.status(403).json({ error: "Token invalid or expired" });
      }

      // Attach the user data to the request object
      req.user = {
        id: payload.sub,
        companyId: payload.companyId,
        role: payload.role
      };
      next();
    });
  } else {
    res.status(401).json({ error: "Authorization header missing" });
  }
};