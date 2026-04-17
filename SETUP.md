# WhatsApp Clone - Backend Setup

## Prerequisites

1. **Node.js** (v14 or higher) installed
2. **MySQL** (v5.7 or higher) running on your machine

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure database credentials:
   
   Edit the `.env` file with your MySQL credentials:
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=whatsapp_clone
   JWT_SECRET=your-secret-key-change-this-in-production
   ```

   Common configurations:
   - **XAMPP/WAMP**: `DB_USER=root`, `DB_PASSWORD=` (empty for default)
   - **MySQL Workbench**: Use your MySQL username and password
   - If MySQL uses a different port, add `DB_PORT=3306` to .env

3. Start the server:
   ```bash
   npm start
   ```

   The server will run at http://localhost:3000

## Database Schema

The application automatically creates:
- Database: `whatsapp_clone`
- Table: `users` with fields:
  - `id` (VARCHAR, PRIMARY KEY)
  - `name` (VARCHAR)
  - `email` (VARCHAR, UNIQUE)
  - `phone` (VARCHAR, UNIQUE)
  - `password` (VARCHAR) - bcrypt hashed
  - `created_at` (TIMESTAMP)
  - `updated_at` (TIMESTAMP)

## API Endpoints

### POST `/api/signup`
Create a new user account.

**Request body:**
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
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "1713435678901",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890"
  }
}
```

### POST `/api/login`
Authenticate user and receive JWT token.

**Request body:**
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
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "1713435678901",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890"
  }
}
```

## Pages

- Sign Up page: http://localhost:3000/signup
- Login page: http://localhost:3000/login
- Home page: http://localhost:3000/

## MVC Architecture

```
whatsapp/
├── config/
│   ├── database.js      # MySQL connection pool
│   └── initDb.js        # Database initialization
├── controllers/
│   └── AuthController.js # Request handlers
├── models/
│   └── User.js          # Database operations
├── routes/
│   └── auth.js          # Route definitions
├── utils/
│   └── authUtils.js     # Password hashing & JWT
├── public/
│   ├── signup.html      # Frontend signup
│   ├── login.html       # Frontend login
│   └── styles.css       # Styles
└── server.js            # Express app entry
```

## Security Features

- Passwords are hashed using bcrypt (10 salt rounds)
- JWT tokens with 24-hour expiration
- Input validation on all endpoints
- Protection against duplicate email/phone

## Troubleshooting

### MySQL Connection Failed
```
Access denied for user 'root'@'localhost'
```

Update your `.env` file with correct credentials. On XAMPP/WAMP:
- Try `DB_PASSWORD=` (leave empty)
- Or use the password you set during MySQL installation

### Port Already in Use
Change the port in `.env`:
```env
PORT=3001
```

### Database Table Already Exists
This is harmless - the app uses `CREATE TABLE IF NOT EXISTS`.

## Development

- All API responses follow the format `{ success: boolean, message: string, ... }`
- Errors are logged to console with full stack traces
- User passwords are never returned in API responses
