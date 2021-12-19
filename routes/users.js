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
const moment = require("moment");

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
  res.render("login", { layout: "singlelayout" });
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
    res.render("login", { errors, email, password, layout: "singlelayout" });
  } else {
    if (email == "admin@gmail.com" && password == "1234567890") {
      // console.log("TEST");
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

//ForgotPassword Handler
router.get("/forgotpassword", (req, res) => {
  res.render("forgotpassword", { layout: "singlelayout" });
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

const checkAuthenicated = function (req, res, next) {
  if (req.isAuthenticated()) {
    res.set(
      "Cache-Control",
      "no-cache,private,no-store,must-relative,post-check=0,pre-check=0"
    );
    return next();
  } else {
    res.redirect("/");
  }
};
//upload file get
router.get("/upload", checkAuthenicated, (req, res) => {
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
      res.render("upload", { buckets: data.Buckets, layout: "layout" });
    }
  });
});

//upload a file post
router.post("/uploaddata", uploads3.array("img", 10), (req, res) => {
  let location = [];
  req.files.map((data) => location.push(data.location));
  // console.log(req.files);
  const id = req.session.passport.user;
  // console.log(location);
  Info.find({ userid: id._id }).then((info) => {
    // const locationDetail = location[location.length - 1];
    // console.log("locationDetail", locationDetail);
    const insertUrlDetail = { url: location, created_at: new Date() };
    const info1 = new Info({
      userid: id._id,
      dataUrl: insertUrlDetail,
    });
    if (info.length == 0) {
      info1.save().then((infor) => {
        // console.log("info", infor);
      });
    } else {
      Info.findOneAndUpdate(
        { userid: id._id },
        { $push: { dataUrl: insertUrlDetail } }
      ).exec((err, result) => {
        if (err) console.error(err);
        // console.log("result", result);
      });
    }
  });
  res.redirect("/dashboard");
});

//Dashboard Handler
router.get("/dashboard", checkAuthenicated, (req, res) => {
  // console.log(req.session.passport.user);
  res.render("dashboard", {
    layout: "layout",
    userId: req.session.passport.user,
  });
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
  res.render("showalluser", { layout: "loginlayout" });
});

router.get("/showalluserstatus", async (req, res) => {
  try {
    const users = await User.find({
      timestamp: { $lte: new Date(), $gte: new Date(Date() - 7) },
    }).lean();
    let info = [];
    users.map(
      (user) =>
        user.email != "admin@gmail.com" &&
        info.push({ id: user._id, name: user.name, email: user.email })
    );
    res.status(200).json(info);
  } catch (err) {
    console.error(err);
  }
});

router.get("/adminshowallfiles", async (req, res) => {
  try {
    const infos = await Info.find().populate("userid", "name").lean();
    let result = [];
    const infos1 = infos.map((info) =>
      info.dataUrl.map((test) =>
        test.url.map((test2) =>
          result.push({
            url: test2,
            filename: test2.split("/").pop(),
            extname: test2.split(".").pop(),
            bucketname: test2.split(".")[0].split("//")[1],
            foldername: test2.split("/")[3],
            username: info.userid.name,
            createdAt: moment(test.created_at).format("YYYY-MM-DD"),
          })
        )
      )
    );
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
  }
});

router.get("/adminallfiles", async (req, res) => {
  res.render("showAllFiles", { layout: "loginlayout" });
});

router.get("/showallfiles/:id", async (req, res) => {
  try {
    const infos = await Info.find({ userid: req.params.id })
      .populate("userid", "name")
      .lean();
    let result = [];
    infos.map((info) =>
      info.dataUrl.map((tes) =>
        tes.url.map((test) =>
          result.push({
            url: test,
            filename: test.split("/").pop(),
            extname: test.split("/").pop(),
            bucketname: test.split(".")[0].split("//")[1],
            foldername: test.split("/")[3],
            username: info.userid.name,
            createdAt: moment(tes.created_at).format("YYYY-MM-DD"),
          })
        )
      )
    );
    res.status(200).json(result);
  } catch (err) {
    console.log(err);
  }
});

router.get("/history", async (req, res) => {
  try {
    const info = await Info.find().lean();
    // console.log(info);
    let result = [];
    info.map((data) => {
      // console.log(data);
      result.push({
        uid: data.userid,
        fname: data.dataUrl.map((url1) => url1.url),
        created_at: data.dataUrl.map((url) =>
          moment(url.created_at).format("YYYY-MM-DD")
        ),
      });
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
    // mergeDetails.map((md) =>
    //   md.allfiles.map((allfile) => console.log(allfile))
    // );
    let newresult = [];
    mergeDetails.map((md) =>
      md.allfiles.map((allfile) =>
        newresult.push({
          fname: allfile.map((af) => af.split("/").pop()),
          name: md.name,
          email: md.email,
          extname: allfile.map((af) => af.split(".").pop()),
          bucketname: allfile.map((af) => af.split(".")[0].split("//")[1]),
          foldername: allfile.map((af) => af.split("/")[3]),
          url: allfile,
        })
      )
    );
    console.log(newresult);
    // let newresult1 = [];
    // newresult.map((newres) =>
    //   newresult1.push({
    //     name: newres.name,
    //     fname: newres.fname.map((newres1) => newres1),
    //   })
    // );
    // console.log(newresult1);
    res.render("history", { layout: "loginlayout", results: newresult });
  } catch (err) {
    console.error(err);
  }
});

router.get("/adduser", (req, res) => {
  res.render("adduser", { layout: "singlelayout" });
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
      layout: "singlelayout",
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

router.get("/uploadlast7days", async (req, res) => {
  try {
    const info = await Info.find({
      timestamp: { $lte: new Date(), $gte: new Date(Date() - 7) },
    }).lean();
    res.status(200).json(info.length);
  } catch (err) {
    console.error(err);
  }
});
router.get("/uploaduserlast7days", async (req, res) => {
  try {
    const user = await User.find({
      timestamp: { $lte: new Date(), $gte: new Date(Date() - 7) },
    }).lean();
    res.status(200).json(user.length);
  } catch (err) {
    console.error(err);
  }
});
router.get("/uploadimageslast7days/:param", async (req, res) => {
  try {
    const images = await Info.find({
      timestamp: { $lte: new Date(), $gte: new Date(Date() - 7) },
    }).lean();
    let UrlArry = images.map((img) => img.dataUrl);
    let urlArry1 = UrlArry.map((url) => url);
    let urlArry2 = [];
    let urlArry3 = [];
    urlArry1.map((url) => url.map((url1) => urlArry2.push(url1.url)));
    let count = 0;
    urlArry2.map((url) => url.map((url1) => urlArry3.push(url1)));
    // console.log(urlArry3);
    urlArry3.map((url) => (url.search(req.params.param) != -1 ? count++ : ""));
    // console.log(count);
    res.status(200).json(count);
    // res.status(200).json(image);
  } catch (error) {
    console.log(error);
  }
});

router.get("/user/:id", async (req, res) => {
  try {
    const infos = await Info.find({ userid: req.params.id }).lean();
    let result = [];
    // console.log(infos);
    infos.map((info) =>
      info.dataUrl.map((inf) =>
        result.push({
          url: inf.url,
          name: inf.url.split("/").pop(),
          extname: inf.url.split(".").pop(),
          bucketname: inf.url.split(".")[0].split("//")[1],
          foldername: inf.url.split("/")[3],
          created_at: moment(inf.created_at).format("YYYY-MM-DD"),
        })
      )
    );
    res.render("showSingleUser", { results: result, layout: "loginlayout" });
  } catch (error) {
    console.log(error);
  }
});

router.get("/deleteuser/:id", async (req, res) => {
  try {
    const infos = await Info.findOneAndRemove({ userid: req.params.id });
    const users = await User.findByIdAndRemove(req.params.id);
    res.redirect("/showalluser");
  } catch (error) {
    console.log(error);
  }
});

router.get("/uploadfilelast7days/:id", async (req, res) => {
  try {
    const info = await Info.findOne({
      userid: req.params.id,
      timestamp: { $lte: new Date(), $gte: new Date(Date() - 7) },
    }).lean();
    // console.log(info);
    if (info != null) res.status(200).json(info.dataUrl.length);
    else res.status(200).json(0);
  } catch (err) {
    console.error(err);
  }
});

router.get("/usershowallfile", (req, res) => {
  res.render("usershowallfile", {
    layout: "layout",
    userId: req.session.passport.user,
  });
});

module.exports = router;
