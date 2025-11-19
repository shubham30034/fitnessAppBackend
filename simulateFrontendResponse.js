// Simulate the exact response that the frontend should receive
const mockResponse = {
  success: true,
  summary: {
    totalCoaches: 6,
    totalActiveSubscriptions: 2,
    totalEstimatedRevenue: 11000,
    totalPeriodRevenue: 0,
    totalPeriodSessions: 0,
    period: 'month'
  },
  coachData: [
    {
      coachId: "684cfd7e87dd540f3ad69c2a",
      coachName: "shubham coach",
      coachEmail: "shubhamkundu45@gmail.com",
      activeSubscriptions: 0,
      totalSubscriptionRevenue: 0,
      totalSessions: 0,
      estimatedRevenue: 0
    },
    {
      coachId: "6854e62c7387d34d8461ffcc",
      coachName: "sarthak coach",
      coachEmail: "shubhamkundu445@gmail.com",
      activeSubscriptions: 0,
      totalSubscriptionRevenue: 0,
      totalSessions: 0,
      estimatedRevenue: 0
    },
    {
      coachId: "68afe051cb3f9a0cbe2aedde",
      coachName: "risabh",
      coachEmail: "risabh37@gmail.com",
      activeSubscriptions: 0,
      totalSubscriptionRevenue: 0,
      totalSessions: 0,
      estimatedRevenue: 0
    },
    {
      coachId: "68c2610d5722e3d0a92ea764",
      coachName: "Test Coach 1",
      coachEmail: "coach1@test.com",
      activeSubscriptions: 0,
      totalSubscriptionRevenue: 0,
      totalSessions: 0,
      estimatedRevenue: 0
    },
    {
      coachId: "68b299778e995698f2331c1d",
      coachName: "Priya Coach",
      coachEmail: "priya.coach@fitnessapp.com",
      activeSubscriptions: 1,
      totalSubscriptionRevenue: 5000,
      totalSessions: 6,
      estimatedRevenue: 5000
    },
    {
      coachId: "68c25db3c91873697d644c3d",
      coachName: "Shubham Coach",
      coachEmail: "shubham.coach@fitnessapp.com",
      activeSubscriptions: 1,
      totalSubscriptionRevenue: 6000,
      totalSessions: 6,
      estimatedRevenue: 6000
    }
  ],
  financial: {
    totalCoaches: 6,
    totalActiveSubscriptions: 2,
    totalEstimatedRevenue: 11000,
    totalPeriodRevenue: 0,
    totalPeriodSessions: 0,
    period: 'month',
    coachData: [
      // Same as coachData above
    ]
  }
};

console.log('Mock Response for Frontend:');
console.log(JSON.stringify(mockResponse, null, 2));

console.log('\nFrontend should display:');
console.log(`Total Coach Revenue: ₹${mockResponse.summary.totalEstimatedRevenue}`);
console.log(`Active Coaches: ${mockResponse.summary.totalCoaches}`);
console.log(`Active Subscriptions: ${mockResponse.summary.totalActiveSubscriptions}`);
console.log(`Total Sessions: ${mockResponse.coachData.reduce((sum, coach) => sum + coach.totalSessions, 0)}`);

console.log('\nCoaches with active subscriptions:');
mockResponse.coachData
  .filter(coach => coach.activeSubscriptions > 0)
  .forEach(coach => {
    console.log(`- ${coach.coachName}: ₹${coach.estimatedRevenue} (${coach.activeSubscriptions} clients, ${coach.totalSessions} sessions)`);
  });
