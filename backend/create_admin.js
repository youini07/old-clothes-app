const axios = require('axios');

async function createAdmin() {
  try {
    const res = await axios.post('https://old-clothes-app-production.up.railway.app/api/auth/init-superadmin', {
      email: 'admin@admin.com',
      password: 'admin',
      name: '슈퍼오너'
    });
    console.log('Created:', res.data);
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}
createAdmin();
