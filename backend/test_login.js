const axios = require('axios');

async function testLogin() {
  try {
    const res = await axios.post('https://old-clothes-app-production.up.railway.app/api/auth/login', {
      email: 'admin@admin.com',
      password: 'admin'
    });
    console.log('Login Success:', res.data);
  } catch (err) {
    console.error('Login Error:', err.response?.data || err.message);
  }
}
testLogin();
