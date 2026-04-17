const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.redirect('/signup');
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/signup', (req, res) => {
    const { name, email, phone, password } = req.body;
    console.log('Signup data:', { name, email, phone, password });
    res.json({ success: true, message: 'Account created successfully!' });
});

app.post('/login', (req, res) => {
    const { emailOrPhone, password } = req.body;
    console.log('Login data:', { emailOrPhone, password });
    res.json({ success: true, message: 'Login successful!' });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});