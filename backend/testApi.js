const axios = require('axios');

async function testApi() {
  try {
    const provRes = await axios.get('https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=*00000000');
    console.log('Provinces:', provRes.data.regcodes.map(r => `${r.code}: ${r.name}`));

    const cityRes = await axios.get('https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=11*00000');
    console.log('Seoul Cities:', cityRes.data.regcodes.map(r => r.name));

    const dongRes = await axios.get('https://grpc-proxy-server-mkvo6j4wsq-du.a.run.app/v1/regcodes?regcode_pattern=11110*&is_ignore_zero=true');
    console.log('Jongno Dongs:', dongRes.data.regcodes.map(r => r.name));
  } catch (err) {
    console.error('Failed', err.message);
  }
}
testApi();
testApi();
