document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();

        if (result.success) {
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            alert('Account created successfully!');
            window.location.href = '/';
        } else {
            alert(result.message || 'Signup failed');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Network error during signup');
    }
});