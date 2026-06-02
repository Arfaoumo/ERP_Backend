async function test() {
  try {
    // 1. login
    const loginRes = await fetch('http://localhost:5000/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@erp.com', password: 'password123' })
    });
    const user = await loginRes.json();
    console.log("Logged in user token:", user.token ? "OK" : "NO");

    const headers = { 
      'Authorization': `Bearer ${user.token}`,
      'Content-Type': 'application/json'
    };

    // 2. get suppliers
    const suppRes = await fetch('http://localhost:5000/api/suppliers', { headers });
    const suppliers = await suppRes.json();
    const supplier = suppliers[0];
    
    // 3. update supplier
    console.log("Updating supplier: ", supplier._id);
    const updateRes = await fetch(`http://localhost:5000/api/suppliers/${supplier._id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        products: [...(supplier.products || []), '6a10de21ad09a664b8dc1f45'] // dummy object id
      })
    });
    const result = await updateRes.text();
    console.log("Update status:", updateRes.status);
    console.log("Update result:", result);
  } catch (e) {
    console.error(e);
  }
}
test();
