# Test Instructions for the User

## Prerequisites
1. Make sure MySQL is running on your machine
2. The database credentials in `.env` should be correct (default: localhost, root, no password)

## To Test

1. **Initialize the database** - The server will do this automatically on first run

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Test Sign Up API:**
   ```bash
   curl -X POST http://localhost:3000/api/signup \
     -H "Content-Type: application/json" \
     -d '{"name":"Test User","email":"test@example.com","phone":"1234567890","password":"password123"}'
   ```

4. **Test Login API:**
   ```bash
   curl -X POST http://localhost:3000/api/login \
     -H "Content-Type: application/json" \
     -d '{"emailOrPhone":"test@example.com","password":"password123"}'
   ```

5. **Test duplicate signup** (should fail):
   ```bash
   curl -X POST http://localhost:3000/api/signup \
     -H "Content-Type: application/json" \
     -d '{"name":"Test User","email":"test@example.com","phone":"1234567890","password":"password123"}'
   ```

6. **Test login with wrong password** (should fail):
   ```bash
   curl -X POST http://localhost:3000/api/login \
     -H "Content-Type: application/json" \
     -d '{"emailOrPhone":"test@example.com","password":"wrongpassword"}'
   ```

## Expected Results

- **SignUp** (201): Returns success, token, and user data (without password)
- **Login** (200): Returns success, token, and user data
- **Duplicate signup** (400): Returns error message
- **Wrong password** (401): Returns invalid credentials error

## MVC Structure

```
whatsapp/
├── config/
│   ├── database.js      # MySQL connection pool
│   └── initDb.js        # Database initialization
├── controllers/
│   └── AuthController.js # Auth business logic
├── models/
│   └── User.js          # User database model
├── routes/
│   └── auth.js          # Auth routes
├── utils/
│   └── authUtils.js     # Password hashing & JWT utilities
├── public/
│   ├── signup.html      # Sign up page
│   └── login.html       # Login page
└── server.js           # Express app entry point
```
