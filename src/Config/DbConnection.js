const mongoose = require("mongoose")
require("dotenv").config()
console.log("MONGO_URI =", process.env.MONGO_URI);
exports.connectDB = async () => {
    const dns = require("node:dns");

dns.setServers(["1.1.1.1", "1.0.0.1"]);

console.log("DNS:", dns.getServers());

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");
} catch (error) {
    console.dir(error, { depth: null });
    process.exit(1);
}
}



