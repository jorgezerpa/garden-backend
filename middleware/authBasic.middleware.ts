import { Response, NextFunction } from 'express';
import { createHash } from "crypto";
import { prisma } from "../lib/prisma";
import { BasicAuthRequest } from '../types/request';

export const authenticateBasic = async(req: BasicAuthRequest, res: Response, next: NextFunction) => {
  try {
    // 1. Extract Basic Auth Header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).send('Authentication required');
    }

    // 2. Decode Base64 (Format is "Basic base64(username:password)")
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');

    const [publicKey, secretKey] = credentials.split(':'); // apiKey is the "username" 
    const secretHash = createHash("sha256").update(secretKey).digest("hex");

    // 3. 
    const company = await prisma.company.findFirst({ // @dev@important@todo why I can not use FindUnique?
        where: { 
            apiKey: {
              publicKey: publicKey
            }
        },
        include: {
          apiKey: {
            select: {
              secretKeyHash: true
            }
          }
        }
    });

    // if (!company) throw new Error("Company not found for provided API Key"); // @audit@dev it is secure to return this reason? like, this is saying "Hey attacker! you can run this to see if you actually have a valid public key"
    if (!company) return res.status(401).send('Unathorized');
    if (company.apiKey?.secretKeyHash !== secretHash) return res.status(401).send('Unauthorized');
    
    req.user = {
      companyId: company.id,
    };

    next()
  } catch (error) {
    res.status(500).json({ error: "Unexpected Error" })  
  }
};

