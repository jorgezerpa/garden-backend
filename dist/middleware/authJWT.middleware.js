import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET;
export const authenticateJWT = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader) {
            const token = authHeader.split(' ')[1]; // Format: "Bearer <token>"
            jwt.verify(token, JWT_SECRET, (err, payload) => {
                if (err) {
                    return res.status(403).json({ error: "Token invalid or expired" });
                }
                // Attach the user data to the request object
                req.user = {
                    id: payload.sub, // id in User tab
                    companyId: payload.companyId,
                    role: payload.role
                };
                next();
            });
        }
        else {
            res.status(401).json({ error: "Authorization header missing" });
        }
    }
    catch (error) {
        res.status(500).json({ error: "Unexpected Error" });
    }
};
export const allowedRoles = (roles) => {
    // return middleware function 
    return (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            if (authHeader) {
                const token = authHeader.split(' ')[1]; // Format: "Bearer <token>"
                jwt.verify(token, JWT_SECRET, (err, payload) => {
                    if (err) {
                        return res.status(403).json({ error: "Token invalid or expired" });
                    }
                    if (!roles.includes(payload.role)) {
                        res.status(401).json({ error: "Path not granted for this role" }); // @dev@todo is this the corect error code for invalid role?
                    }
                    next();
                });
            }
            else {
                res.status(401).json({ error: "Authorization header missing" });
            }
        }
        catch (error) {
            res.status(500).json({ error: "Unexpected Error" });
        }
    };
};
