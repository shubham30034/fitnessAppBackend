const axios = require('axios');

// Test the actual endpoint that the frontend is calling
const testActualEndpoint = async () => {
  try {
    console.log('🔍 Testing the actual endpoint that frontend calls...');
    
    // This is the endpoint the frontend calls: /api/coachmanager/financial/overview
    const url = 'http://localhost:5000/api/coachmanager/financial/overview';
    
    // You would need a valid token here, but let's check if the endpoint exists
    console.log('📡 Endpoint URL:', url);
    console.log('📡 This should call CoachManagerController.getFinancialOverview');
    console.log('📡 Which should return actual subscription fees (₹11000)');
    
    console.log('\n🎯 Expected Result:');
    console.log('  totalEstimatedRevenue: 11000 (₹5000 + ₹6000)');
    console.log('  totalActiveSubscriptions: 2');
    
    console.log('\n❌ If showing ₹2000, then:');
    console.log('  1. Frontend might be calling SuperAdmin endpoint instead');
    console.log('  2. There might be a routing issue');
    console.log('  3. There might be a caching issue');
    
    console.log('\n🔧 To fix:');
    console.log('  1. Check browser network tab to see which endpoint is called');
    console.log('  2. Verify the frontend service is calling the correct URL');
    console.log('  3. Clear browser cache and test again');
    
  } catch (error) {
    console.error('❌ Error testing endpoint:', error.message);
  }
};

testActualEndpoint();
