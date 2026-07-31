const dns = require("dns").promises;

(async () => {
  try {
    const records = await dns.resolveSrv(
      "_mongodb._tcp.fitnessapptesting.snjdbrr.mongodb.net"
    );
    console.log(records);
  } catch (err) {
    console.error(err);
  }
})();