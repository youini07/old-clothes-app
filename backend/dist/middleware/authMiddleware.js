"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.optionalAuthenticate = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '인증 토큰이 제공되지 않았습니다.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
        req.user = decoded;
        next();
    }
    catch (error) {
        return res.status(401).json({ error: '유효하지 않거나 만료된 토큰입니다.' });
    }
};
exports.authenticate = authenticate;
const optionalAuthenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
            req.user = decoded;
        }
        catch (error) {
            // invalid token is ignored in optional auth
        }
    }
    next();
};
exports.optionalAuthenticate = optionalAuthenticate;
// 특정 권한만 허용하는 미들웨어 (예: requireRole(['SUPER_ADMIN', 'PARTNER']))
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: '인증이 필요합니다.' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: '접근 권한이 없습니다.' });
        }
        next();
    };
};
exports.requireRole = requireRole;
