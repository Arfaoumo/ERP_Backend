const http = require('http');

const data = JSON.stringify({ email: 'admin@erp.com', password: 'password123' });

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const user = JSON.parse(body);
    console.log("Token:", user.token ? "OK" : "NO");

    // Get suppliers
    http.get('http://localhost:5000/api/suppliers', {
      headers: { 'Authorization': `Bearer ${user.token}` }
    }, (res2) => {
      let body2 = '';
      res2.on('data', d => body2 += d);
      res2.on('end', () => {
        const suppliers = JSON.parse(body2);
        const supplier = suppliers[0];
        console.log("Updating supplier:", supplier._id);

        const putData = JSON.stringify({
          products: [...(supplier.products || []), '6a10de21ad09a664b8dc1f45']
        });

        const putOptions = {
          hostname: 'localhost',
          port: 5000,
          path: `/api/suppliers/${supplier._id}`,
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`,
            'Content-Length': Buffer.byteLength(putData)
          }
        };

        const req3 = http.request(putOptions, res3 => {
          let body3 = '';
          res3.on('data', d => body3 += d);
          res3.on('end', () => {
            console.log("Status:", res3.statusCode);
            console.log("Response:", body3);
          });
        });
        req3.write(putData);
        req3.end();
      });
    });
  });
});
req.write(data);
req.end();
