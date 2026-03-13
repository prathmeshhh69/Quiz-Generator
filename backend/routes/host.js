const express = require("express");

const router = express.Router();

router.post("/verify-password", (req, res) => {
  const { password } = req.body || {};
  const expectedPassword = process.env.HOST_PASSWORD;

  if (typeof password !== "string") {
    res.status(400).json({
      success: false,
      message: "Password is required"
    });
    return;
  }

  if (password === expectedPassword) {
    res.json({
      success: true,
      token: "host_verified"
    });
    return;
  }

  res.status(401).json({
    success: false,
    message: "Wrong password"
  });
});

module.exports = router;
