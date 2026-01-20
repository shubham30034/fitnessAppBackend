exports.enforceTempPwToken = (req, res, next) => {
  // if temp token, allow only change-password endpoint
  if (req.user?.pw === true) {
    if (req.originalUrl.includes("/change-password")) return next();

    return res.status(403).json({
      success: false,
      message: "Password change required. Access restricted.",
    });
  }

  return next();
};
