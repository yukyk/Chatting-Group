const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const SALT_ROUNDS = 10;

const hashPassword = async (password) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
  
  req.user = decoded;
  next();
};

const AuthController = {
  async signup(req, res) {
    try {
      const { name, email, phone, password } = req.body;

      if (!name || !email || !phone || !password) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required'
        });
      }

      const existingUser = await User.findOne({ 
        where: { 
          [Op.or]: [{ email }, { phone }] 
        } 
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email or phone already exists'
        });
      }

      const hashedPassword = await hashPassword(password);

      const newUser = await User.create({
        name,
        email,
        phone,
        password: hashedPassword
      });

      const token = generateToken(newUser.id, newUser.email);

      res.status(201).json({
        success: true,
        message: 'Account created successfully!',
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone
        }
      });

    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during signup'
      });
    }
  },

  async login(req, res) {
    try {
      const { emailOrPhone, password } = req.body;

      if (!emailOrPhone || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email/Phone and password are required'
        });
      }

      const user = await User.findOne({
        where: {
          [Op.or]: [{ email: emailOrPhone }, { phone: emailOrPhone }]
        }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const isPasswordValid = await comparePassword(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const token = generateToken(user.id, user.email);

      res.json({
        success: true,
        message: 'Login successful!',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during login'
      });
    }
  }
};

module.exports = { AuthController, generateToken, verifyToken, authMiddleware };