// services/smsService.js
exports.sendSMS = async ({ to, message }) => {
  // TODO: integrate Twilio / MSG91 / Fast2SMS
  // return await provider.send({ to, message });

  console.log("📩 SMS TO:", to);
  console.log("📩 SMS MSG:", message);
  return true;
};
