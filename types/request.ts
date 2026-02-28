import { Request } from 'express';

export interface BasicAuthRequest extends Request {
  user?: {
    companyId: number;
  };
}


export interface JWTAuthRequest extends Request {
  user?: {
    id: number;
    companyId: number;
    role: string;
  };
}
