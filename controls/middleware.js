const jwt = require('jsonwebtoken');
const { login } = require('../models/login');
module.exports = {
    isAdmin: async function(req, res, next) {
        const token = req.headers['token'];
        if (token) {
            try {
                const decoded = jwt.verify(token, "hehe123");
                const user = await login.findOne({ _id: decoded.id, status: true });
                if (!user) {
                    return res.status(401).json({ status: false, message: 'Unauthorized access' });
                }
                if (user.role !== 'admin') {
                    return res.status(403).json({ status: false, message: 'Forbidden access' });
                }
                req.user = user;
            } catch (error) {
                return res.status(401).json({ status: false, message: 'Invalid token' });
            }
        } else {
            return res.status(401).json({ status: false, message: 'Invalid token' });
        }
        next();
    },
    isUser: async function(req, res, next) {
        const token = req.headers['token'];
        if (token) {
            try {
                const decoded = jwt.verify(token, "hehe123");
                const user = await login.findOne({ _id: decoded.id, status: true });
                if (!user) {
                    return res.status(401).json({ status: false, message: 'Unauthorized access' });
                }
                if (user.role !== 'enduser') {
                    return res.status(403).json({ status: false, message: 'Forbidden access' });
                }
                req.user = user;
            } catch (error) {

                return res.status(401).json({ status: false, message: 'Invalid token' });
            }
        } else {
            return res.status(401).json({ status: false, message: 'Invalid token' });
        }
        next();
    },
};
