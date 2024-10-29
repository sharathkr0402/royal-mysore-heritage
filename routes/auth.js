////////////////////////////////////////////////////////////////////////////////////////////////

const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
//
//
//
// Importing models
const Admin = require("../models/Admin");
const Customer = require("../models/Customer");
//
//
//
// Configure Nodemailer
const transporter = nodemailer.createTransport({
  service: "Gmail", // e.g., Gmail, you can use other services
  auth: {
    user: "sharathkr0402@gmail.com",
    pass: "uzhq jkum xyqd fnlh",
  },
});

// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
  if (req.session.user && req.session.role) {
    return next();
  }
  req.flash("error_msg", "Please log in to view that resource");
  res.redirect("/login");
}
//
//
//
// Middleware to check user roles
function isAdmin(req, res, next) {
  if (req.session.role === "admin") {
    return next();
  } else {
    res.status(403).send("Access denied. Admins only.");
  }
}
function isCustomer(req, res, next) {
  if (req.session.role === "customer") {
    return next();
  } else {
    res.status(403).send("Access denied. Customers only.");
  }
}
//
//
//
// Registration Route - GET
router.get("/register", (req, res) => {
  res.render("../views/authentication/register", { errors: [] });
});

// Registration Route - POST
router.post("/register", async (req, res) => {
  const { role, name, email, mobile, address, password, password2 } = req.body;
  let errors = [];

  const idNo = "BGB" + mobile;
  // Set regDate as current date
  const date = new Date();
  // Basic validation
  if (!name || !email || !address || !password || !password2 || !mobile) {
    errors.push({ msg: "Please enter all fields" });
  }

  if (password !== password2) {
    errors.push({ msg: "Passwords do not match" });
  }

  if (password && password.length < 8) {
    errors.push({ msg: "Password must be at least 8 characters" });
  }

  if (errors.length > 0) {
    res.render("../views/authentication/register", {
      errors,
      name,
      email,
      address,
      mobile,
      password,
      password2,
    });
  } else {
    let user;
    // Check if user exists
    switch (role) {
      case "admin":
        user = await Admin.findOne({ email: email });
        break;
      case "customer":
        user = await Customer.findOne({ email: email });
        break;
    }
    if (user) {
      errors.push({ msg: "Email already exists" });
      res.render("../views/authentication/register", {
        errors,
        name,
        email,
        address,
        mobile,
        password,
        password2,
      });
    } else {
      try {
        let newUser;
        switch (role) {
          case "admin":
            newUser = new Admin({
              name,
              email,
              address,
              idNo,
              mobile,
              password,
              role: "admin",
              date,
            });
            break;
          case "customer":
            newUser = new Customer({
              name,
              email,
              address,
              idNo,
              mobile,
              password,
              role: "customer",
              date,
            });
            break;
          default:
            return res.status(400).send("Invalid role selected.");
        }

        await newUser.save();
        req.flash("success_msg", "You Sucessfully Registered, Please Login.");
        res.redirect("/login");
      } catch (error) {
        console.log(error);
        res.status(500).send("Error registering new user.");
      }
    }
  }
});

// Login Route - GET
router.get("/login", (req, res) => {
  res.render("../views/authentication/login", { errors: [] });
});

// Login Route - POST
router.post("/login", async (req, res) => {
  const { email, password, role } = req.body;
  let errors = [];

  if (!email || !password || !role) {
    errors.push({ msg: "Please enter all fields" });
    return res.render("../views/authentication/login", {
      errors,
      email,
      password,
      role,
    });
  }

  try {
    let user;
    switch (role) {
      case "admin":
        user = await Admin.findOne({ email });
        if (!user) {
          errors.push({ msg: "That email is not registered" });
          return res.render("../views/authentication/login", {
            errors,
            role,
            email,
            password,
          });
        }
        break;
      case "customer":
        user = await Customer.findOne({ email });
        if (!user) {
          errors.push({ msg: "That email is not registered" });
          return res.render("../views/authentication/login", {
            errors,
            role,
            email,
            password,
          });
        }
        break;
      default:
        return res.status(400).send("Invalid role selected.");
    }

    if (user && (await user.comparePassword(password))) {
      req.session.userId = user._id;
      req.session.role = user.role;
    } else {
      errors.push({ msg: "Incorrect password" });
      return res.render("../views/authentication/login", {
        errors,
        role,
        email,
        password,
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // OTP valid for 10 minutes
    await user.save();

    // Send OTP via email
    const mailOptions = {
      from: "sharathkr0402@gmail.com",
      to: user.email,
      subject: "Your OTP Code",
      text: `Your OTP code is ${otp}. It is valid for 10 minutes.`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Nodemailer Error:", error);
        req.flash("error_msg", "Error sending OTP. Please try again.");
        return res.redirect("/login");
      } else {
        console.log("Email sent: " + info.response);
        // Store user ID in session for OTP verification
        req.session.tempUser = { id: user._id };
        res.redirect("/otp");
      }
    });
  } catch (err) {
    console.log(err);
    res.redirect("/login");
  }
});

// OTP Verification Route - GET
router.get("/otp", (req, res) => {
  if (!req.session.tempUser) {
    req.flash("error_msg", "Please log in first");
    return res.redirect("/login");
  }
  res.render("../views/authentication/otp", { errors: [] });
});

// OTP Verification Route - POST
router.post("/otp", async (req, res) => {
  const { otp } = req.body;
  let errors = [];

  if (!otp) {
    errors.push({ msg: "Please enter the OTP" });
    return res.render("../views/authentication/otp", { errors });
  }

  if (!req.session.tempUser) {
    req.flash("error_msg", "Session expired. Please log in again.");
    return res.redirect("/login");
  }

  try {
    let user;
    let role = req.session.role;

    switch (role) {
      case "admin":
        user = await Admin.findById(req.session.tempUser.id);
        break;
      case "customer":
        user = await Customer.findById(req.session.tempUser.id);
        break;
      default:
        return res.status(400).send("Invalid role selected.");
    }
    if (!user) {
      errors.push({ msg: "User not found" });
      return res.render("../views/authentication/otp", { errors });
    }

    if (user.otp !== otp) {
      errors.push({ msg: "Incorrect OTP" });
      return res.render("../views/authentication/otp", { errors });
    }

    if (user.otpExpires < Date.now()) {
      errors.push({ msg: "OTP has expired" });
      return res.render("../views/authentication/otp", { errors });
    }

    // OTP is valid
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    req.session.user = user;
    delete req.session.tempUser;

    res.redirect("/dashboard" + user.role);
  } catch (err) {
    console.log(err);
    res.redirect("/login");
  }
});
//
//
//
///////////////////////////  Profile Details  ///////////////////
router.get("/profileDetails", ensureAuthenticated, (req, res) => {
  res.render("../views/details/profiledetails");
});

//
//
//
//
/////////////////////  Profile Details Edit and Update  ////////////////
router.get("/profileedit", ensureAuthenticated, (req, res) => {
  res.render("../views/details/profileedit");
});
router.post("/profileedit/:id", ensureAuthenticated, (req, res) => {
  res.render("../views/details/profileedit");
});
//
//
//
//
//
//
///////////////////// All Admin's ////////////////////////////////////
//All Customers
router.get("/allCustomers", ensureAuthenticated, async (req, res) => {
  const allCustomers = await Customer.find({});
  res.render("../views/manageuser/allCustomers", { allCustomers });
});
//
//
//
//
//
//
//
//
// Logout Route
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
      res.redirect("/dashboard" + req.session.user.role);
    } else {
      res.clearCookie("connect.sid");
      res.redirect("/login");
    }
  });
});

module.exports = router;
