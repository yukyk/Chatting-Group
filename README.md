# WhatsApp Clone - Chat Application

A Node.js Express backend with MVC architecture, MySQL database, JWT authentication, Socket.IO real-time chat, and password encryption.

## Features

- **Sign Up** with name, email, phone, and password
- **Login** with email/phone and password
- **Real-time chat** using Socket.IO
- **Password encryption** using bcrypt (10 salt rounds)
- **JWT token** generation (24-hour expiration)
- **MySQL database** with proper schema
- **MVC architecture** for clean separation of concerns
- **Input validation** and error handling

## Project Structure

```
whatsapp/
├── config/
│   └── initDb.js        # Database initialization
├── controllers/
│   ├── AuthController.js # Authentication request handlers
│   └── chatController.js # Chat request handlers
├── models/
│   ├── User.js          # User database model
│   └── Message.js       # Message database model
├── routes/
│   ├── auth.js          # Authentication API routes
│   └── chat.js          # Chat API routes
├── socket-io/
│   ├── index.js         # Socket.IO initialization
│   ├── middleware.js    # Socket authentication middleware
│   └── handlers/
│       └── chat.js      # Socket chat event handlers
├── utils/
│   └── util.js          # Sequelize database connection
├── public/
│   ├── css/
│   │   └── chat.css     # Chat page styles
│   ├── js/
│   │   └── chat.js      # Chat page JavaScript
│   ├── login.js         # Login page JavaScript
│   ├── signup.js        # Signup page JavaScript
│   └── styles.css       # Global styles
├── views/
│   ├── chat.html        # Chat interface
│   ├── login.html       # Login page
│   └── signup.html      # Signup page
├── .env                 # Environment variables
├── server.js            # Express app entry point
├── package.json         # Dependencies
├── SETUP.md             # Detailed setup instructions
├── TEST_INSTRUCTIONS.md # API testing instructions
└── test-auth.ps1        # PowerShell test script
```

## Quick Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure database:**
   Update `.env` with your MySQL credentials:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=whatsapp_clone
   JWT_SECRET=your-secret-key-change-this-in-production
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

   Server runs at: http://localhost:3000

4. **Access pages:**
   - Sign Up: http://localhost:3000/signup
   - Login: http://localhost:3000/login

## API Endpoints

### POST `/api/signup`
Create a new account.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "password": "securepassword123"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully!",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "user": {
    "id": "1713435678901",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890"
  }
}
```

### POST `/api/login`
Authenticate user.

**Request:**
```json
{
  "emailOrPhone": "john@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful!",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "user": {
    "id": "1713435678901",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890"
  }
}
```

### Error Responses

All errors follow this format:
```json
{
  "success": false,
  "message": "Error description"
}
```

Common HTTP status codes:
- `400` - Validation error or duplicate user
- `401` - Invalid credentials
- `500` - Server error

## Database Schema

The app automatically creates `whatsapp_clone` database and `users` table:

```sql
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Security

- **Bcrypt** for password hashing (salt rounds: 10)
- **JWT** for session management (24h expiry)
- **Never** store plain text passwords
- **Never** return password in API responses
- Input validation on all endpoints

## Frontend Integration

The frontend (HTML pages) is already connected to the backend APIs:

- Form submissions POST to `/api/signup` and `/api/login`
- Success responses store JWT token and user data in `localStorage`
- Tokens can be used for subsequent authenticated requests

Example frontend usage:
```javascript
const response = await fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ emailOrPhone, password })
});
const data = await response.json();
if (data.success) {
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
}
```

## Troubleshooting

### MySQL Connection Failed
If you see:
```
Access denied for user 'root'@'localhost'
```
Update `.env` with correct MySQL credentials. On XAMPP/WAMP default is usually:
- User: `root`
- Password: (empty) or `""`

### Port Already in Use
Change `PORT` in `.env` to a different value (e.g., `3001`).

### Database Already Exists
This is harmless - the app uses `CREATE DATABASE IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS`.

## Requirements

- Node.js >= 14.0.0
- MySQL >= 5.7 or MariaDB >= 10.2
- npm or yarn

## License

ISC
