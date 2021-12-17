const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const passport = require("passport");
const AWS = require("aws-sdk");
const Info = require("../models/Info");
const uploads3 = require("../middleware/awsupload");
const nodemailer = require("nodemailer");
const keyId = require("../config/key").accessKeyId;
const secretkey = require("../config/key").secretAccessKey;
const region = require("../config/key").region;
function sendMail(to, msg) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "anand9412868527@gmail.com",
      pass: "anand8979669612@",
    },
  });

  var mailOptions = {
    from: "anand9412868527@gmail.com",
    to: to,
    subject: "Password",
    text: `Your Password is ${msg}`,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
}

router.get("/", (req, res) => {
  res.render("login", { layout: "loginlayout" });
});

//Login Handler
router.post("/login", (req, res, next) => {
  const { email, password } = req.body;
  let errors = [];

  // //Check required fields
  if (!email) {
    errors.push({ msg: "Please Fill the Email Field" });
  }
  if (!password) {
    errors.push({ msg: "Please Fill the Password Field" });
  }
  if (errors.length > 0) {
    res.render("login", { errors, email, password, layout: "loginlayout" });
  } else {
    if (email == "admin@gmail.com" && password == "1234567890") {
      console.log("TEST");
      // req.session.passport.user = email;
      res.redirect("/admin");
    } else {
      passport.authenticate("local", {
        successRedirect: "/dashboard",
        failureRedirect: "/",
        failureFlash: true,
      })(req, res, next);
    }
  }
});

router.get("/adduser", (req, res) => {
  res.render("adduser", { layout: "loginlayout" });
});

//AddUser Handler
router.post("/adduser", (req, res) => {
  const { name, email, password, userType } = req.body;
  let errors = [];

  //Check required fields
  if (!name) {
    errors.push({ msg: "Please Fill the Name Field" });
  }
  if (!email) {
    errors.push({ msg: "Please Fill the Email Field" });
  }
  if (!password) {
    errors.push({ msg: "Please Fill the Password Field" });
  }

  //Check pass length
  if (password.length < 6) {
    errors.push({ msg: "Password must contain more than 6 character" });
  }

  if (errors.length > 0) {
    res.render("adduser", {
      errors,
      name,
      email,
      password,
      layout: "loginlayout",
    });
  } else {
    const newUser = new User({
      name,
      email,
      password,
      userType,
    });
    //Hash Password
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(newUser.password, salt, (err, hash) => {
        if (err) throw err;
        //Set Password to hashed
        newUser.password = hash;
        newUser
          .save()
          .then((user) => {
            req.flash("success_msg", "You are now register and can log in");
            sendMail(email, password);
            res.redirect("/admin");
          })
          .catch((err) => console.log(err));
      });
    });
  }
});

//ForgotPassword Handler
router.get("/forgotpassword", (req, res) => {
  res.render("forgotpassword", { layout: "loginlayout" });
});

router.post("/forgotpassword", async (req, res) => {
  const { email, password } = req.body;
  sendMail(email, password);
  const salt = await bcrypt.genSalt(10);
  let hashedPassword = await bcrypt.hash(req.body.password, salt);
  const newUserCreditinal = { email, password: hashedPassword };
  try {
    let user = await User.findOneAndUpdate(
      { email: email },
      newUserCreditinal,
      {
        new: true,
        runValidators: true,
      }
    );
    res.redirect("/showalluser");
  } catch (error) {
    console.log(error);
  }
});

router.get("/ajaxupload/:param", (req, res) => {
  let bucketname = req.params.param;

  const s3 = new AWS.S3({
    accessKeyId: keyId,
    secretAccessKey: secretkey,
    region: region,
  });

  async function test2() {
    await s3
      .listObjectsV2({
        Bucket: bucketname,
      })
      .promise()
      .then((data) => {
        let result = [];
        data.Contents.forEach(
          (content) => content.Size == 0 && result.push(content.Key)
        );
        res.status(200).json(result);
      });
  }
  test2();
});

router.get("/test", (req, res) => {
  res.render("pdfviewer");
});

//upload file get
router.get("/upload", (req, res) => {
  // Set Amazon Uploading Engine
  const s3 = new AWS.S3({
    accessKeyId: keyId,
    secretAccessKey: secretkey,
    region: region,
  });

  s3.listBuckets((err, data) => {
    if (err) {
      console.log("Error", err);
    } else {
      res.render("upload", { buckets: data.Buckets });
    }
  });
});

//upload a file post
router.post("/uploaddata", uploads3.array("img", 10), (req, res) => {
  let location = [];
  req.files.map((data) => location.push(data.location));
  const id = req.session.passport.user;
  // console.log(location);
  Info.find({ userid: id._id }).then((info) => {
    const locationDetail = location[location.length - 1];
    console.log("locationDetail", locationDetail);
    const insertUrlDetail = { url: locationDetail, created_at: new Date() };
    const info1 = new Info({
      userid: id._id,
      dataUrl: insertUrlDetail,
    });
    if (info.length == 0) {
      info1.save().then((infor) => {
        console.log("info", infor);
      });
    } else {
      Info.findOneAndUpdate(
        { userid: id._id },
        { $push: { dataUrl: insertUrlDetail } }
      ).exec((err, result) => {
        if (err) console.error(err);
        console.log("result", result);
      });
    }
  });
  res.redirect("/dashboard");
});

const checkAuthenicated = function (req, res, next) {
  if (req.isAuthenticated()) {
    res.set(
      "Cache-Control",
      "no-cache,private,no-store,must-relative,post-check=0,pre-check=0"
    );
    return next();
  } else {
    res.redirect("/login");
  }
};
//Dashboard Handler
router.get("/dashboard", checkAuthenicated, (req, res) => {
  // console.log(req.session.passport.user);
  // res.sendFile(require("path").resolve(__dirname, ".." + "/dashboard.html"));
  res.render("dashboard");
});

//Logout Handler
router.get("/logout", (req, res) => {
  req.logout();
  req.flash("success_msg", "You are logged Out");
  res.redirect("/");
});

router.get("/admin", (req, res) => {
  res.render("admindashboard", { layout: "loginlayout" });
});

router.get("/showalluser", async (req, res) => {
  try {
    const users = await User.find().lean();
    // console.log(users);
    let info = [];
    users.map(
      (user) =>
        user.email != "admin@gmail.com" &&
        info.push({ id: user._id, name: user.name, email: user.email })
    );
    // console.log(info);
    res.render("showalluser", { users: info });
    // res.render('dashboard',{
    //     name:req.user.firstName+" "+req.user.lastName,
    //     stories
    // })
    // res.render("showuser", { users });
  } catch (err) {
    console.error(err);
  }
});

router.get("/showallfiles", async (req, res) => {
  try {
    const info = await Info.find({ userid: req.session.passport.user }).lean();
    // console.log(info);
    let result = [];
    info[0].dataUrl.map((data) => {
      // console.log(data);
      result.push({
        url: data,
        name: data.split("/").pop(),
        extname: data.split(".").pop(),
        bucketname: data.split(".")[0].split("//")[1],
        foldername: data.split("/")[3],
      });
    });
    // console.log(req.session.passport.user.name);
    // res.render('dashboard',{
    //     name:req.user.firstName+" "+req.user.lastName,
    //     stories
    // })
    res.render("showAllFiles", {
      layout: "layout",
      users: result,
      name: req.session.passport.user.name,
    });
  } catch (err) {
    console.error(err);
  }
});

router.get("/history", async (req, res) => {
  try {
    const info = await Info.find().lean();
    // console.log(info);
    let result = [];
    info.map((data) => {
      // console.log(data);
      result.push({ uid: data.userid, fname: data.dataUrl.map((url) => url) });
    });
    // console.log(result);
    let alldetails = await Promise.all(
      result.map((newres) => User.findById(newres.uid))
    );
    // console.log(alldetails);
    let mergeDetails = [];
    for (let i = 0; i < alldetails.length; i++) {
      result.find((res) => {
        if (res.uid.equals(alldetails[i]._id)) {
          const newObj = {
            name: alldetails[i].name,
            email: alldetails[i].email,
            allfiles: res.fname,
          };
          mergeDetails.push(newObj);
          return newObj;
        }
      });
    }
    // console.log(mergeDetails);
    let newresult = [];
    mergeDetails.map((md) =>
      md.allfiles.map((allfile) =>
        newresult.push({
          fname: allfile.split("/").pop(),
          name: md.name,
          email: md.email,
          extname: allfile.split(".").pop(),
          bucketname: allfile.split(".")[0].split("//")[1],
          foldername: allfile.split("/")[3],
          url: allfile,
        })
      )
    );
    console.log(newresult);
    res.render("history", { layout: "layout", users: newresult });
  } catch (err) {
    console.error(err);
  }
});

// router.get("/:id", async (req, res) => {
//   try {
//     const info = await Info.find({ userid: req.params.id }).lean();
//     let result = [];
//     info[0].dataUrl.map((data) => {
//       console.log(data);
//       let parts = data.substring(0, data.lastIndexOf("/"));
//       result.push({
//         url: data,
//         name: data.split("/").pop(),
//         extname: data.split(".").pop(),
//         bucketname: data.split(".")[0].split("//")[1],
//         foldername: parts.split("/")[3],
//       });
//     });

//     res.render("showAllFiles", { users: result });
//   } catch (err) {
//     console.error(err);
//   }
// });

module.exports = router;
