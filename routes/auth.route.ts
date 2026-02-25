import { Router, Request, Response } from 'express';
import { createUser, findUserByEmail } from '../controllers/Auth.controller';
import { registerCompany } from '../controllers/Company.controller';
import {hash, compare} from 'bcrypt'; // Assuming you use bcrypt for hashing/checking

const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { companyName, admin_email, admin_name, password } = req.body;

    // 1. Basic Sanitization & Validation
    // @todo assert email regex
    if (!admin_email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const cleanEmail = admin_email.toLowerCase().trim();
    
    // 2. Business Logic (Check if exists)
    const existing = await findUserByEmail(cleanEmail);
    if (existing) return res.status(409).json({ error: "User already exists" });

    // 3. Hashing (Usually done before the controller to keep controller DB-pure)
    const saltRounds = 10;
    const passwordHash = await hash(password, saltRounds);

    // 4. Create company and user
    const { company, user } = await registerCompany(
      companyName,
      admin_email,
      passwordHash,
      admin_name
    )

    return res.status(201).json({ companyId: company.id, userId: user.id });
  } catch (error) {
    console.error("DEBUG ERROR:", error)
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const user = await findUserByEmail(email.toLowerCase().trim());
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const match = await compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    // Here you would typically generate a JWT
    return res.status(200).json({ message: "Login successful", role: user.role });
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default authRouter;