const axios = require('axios');

async function testActualAPI() {
  try {
    console.log('Testing actual API endpoint...\n');
    
    // Test the CoachManager financial overview endpoint
    const response = await axios.get('http://localhost:5000/api/v1/coach-manager/financial/overview', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODJjNDNlNjdiNjZhMmFlYTdjZGNlMTEiLCJwaG9uZSI6IjgyNzk4OTgxMjgiLCJyb2xlIjoic3VwZXJhZG1pbiIsImlhdCI6MTcyNjA2NzQ0MCwiZXhwIjoxNzI2MTUzODQwfQ.8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q'
      }
    });
    
    console.log('API Response Status:', response.status);
    console.log('API Response Data:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
  }
}

testActualAPI();
