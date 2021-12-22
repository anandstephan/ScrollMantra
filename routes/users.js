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
const multer = require("multer");
const fs = require("fs-extra");
const Track = require("../models/Track");

var ObjectId = require("mongoose").Types.ObjectId;

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./views/uploads/");
  },
  filename: function (req, file, cb) {
    let extArray = file.mimetype.split("/");
    let extension = extArray[extArray.length - 1];
    cb(null, file.fieldname + "-" + Date.now() + "." + extension);
  },
});
var upload = multer({ storage: storage });

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
    text: `Welcome to ScrollMantra AWS Interface.
           username -: ${to} and password -: ${msg}`,
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
    passport.authenticate("local", {
      successRedirect: "/dashboard",
      failureRedirect: "/",
      failureFlash: true,
    })(req, res, next);
  }
});

//ForgotPassword Handler
router.get("/forgotpassword/:emailid", (req, res) => {
  res.render("forgotpassword", {
    layout: "singlelayout",
    emailId: req.params.emailid,
  });
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
    req.flash("success_msg", "password has been changed");
    res.redirect("/showalluser");
  } catch (error) {
    console.log(error);
  }
});

router.get("/ajaxupload/:param", (req, res) => {
  let bucketname = req.params.param;
  // console.log(bucketname);
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

router.get("/ajaxupload2/:param", (req, res) => {
  let bucketname = req.params.param;
  // console.log(bucketname);
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
        let result1 = [];
        data.Contents.forEach(
          (content) => content.Size == 0 && result.push(content.Key)
        );
        data.Contents.forEach(
          (content) => content.Size != 0 && result1.push(content.Key)
        );
        res.status(200).json({ result, result1 });
      });
  }
  test2();
});

router.post("/deletefile", async (req, res) => {
  const s3 = new AWS.S3({
    accessKeyId: keyId,
    secretAccessKey: secretkey,
    region: region,
  });

  let bucketname = req.body.bucketname;
  let key = req.body.folder + "/" + req.body.filename;
  const params = {
    Bucket: bucketname,
    Key: key, //if any sub folder-> path/of/the/folder.ext
  };
  try {
    await s3.headObject(params).promise();
    // console.log("File Found in S3");
    try {
      await s3.deleteObject(params).promise();
      // console.log("file deleted Successfully");
      try {
        const Track1 = new Track({
          filename: req.body.filename,
          bucketname: req.body.bucketname,
          foldername: req.body.folder,
          userid: req.session.passport.user,
        });
        let saveUser = await Track1.save();
        // console.log(saveUser);
      } catch (err) {
        console.log("save error", err);
      }
    } catch (err) {
      console.log("ERROR in file Deleting : " + JSON.stringify(err));
    }
  } catch (err) {
    req.flash("error_msg", "File Not Found");
    // console.log("File not Found ERROR : " + err.code);
  }
  // req.flash("success_msg", "File has been deleted successfully");
  return res.status(200).json({ msg: "File has been Deleted" });
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
      res.render("upload", {
        buckets: data.Buckets,
        layout: "layout",
        userId: req.session.passport.user,
      });
    }
  });
});

router.get("/adminupload", checkAuthenicated, (req, res) => {
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
      res.render("upload", {
        buckets: data.Buckets,
        layout: "loginlayout",
        userId: req.session.passport.user,
      });
    }
  });
});

//Admin Delete
router.get("/admindelete", checkAuthenicated, (req, res) => {
  const s3 = new AWS.S3({
    accessKeyId: keyId,
    secretAccessKey: secretkey,
    region: region,
  });

  s3.listBuckets((err, data) => {
    if (err) {
      console.log("Error", err);
    } else {
      res.render("uploadelete", {
        buckets: data.Buckets,
        layout: "loginlayout",
        userId: req.session.passport.user,
      });
    }
  });
});
//upload pic
router.get("/uploadpic", checkAuthenicated, (req, res) => {
  // Set Amazon Uploading Engine
  res.render("uploadpic", {
    layout: "layout",
    userId: req.session.passport.user,
  });
});

router.get("/adminuploadpic", checkAuthenicated, (req, res) => {
  // Set Amazon Uploading Engine
  res.render("uploadpic", {
    layout: "loginlayout",
    userId: req.session.passport.user,
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
  req.flash("success_msg", "Data Uploaded successfully");
  if (req.session.passport.user.userType == "admin")
    res.redirect("/adminupload");
  else res.redirect("/upload");
});

router.post("/uploadpicdata", upload.single("img"), async (req, res) => {
  // Define a JSONobject for the image attributes for saving to database
  // console.log(req.file.filename);
  const updateuser = req.session.passport.user;
  updateuser.image = req.file.filename;
  // console.log(updateuser);
  try {
    let test = await User.findOneAndUpdate(
      {
        email: req.session.passport.user.email,
      },
      { $set: { image: req.file.filename } },
      { new: true }
    );
    // console.log(test);
    res.redirect("/dashboard");
  } catch (error) {
    console.log(error);
  }
});

//Dashboard Handler
router.get("/dashboard", checkAuthenicated, (req, res) => {
  // console.log(req.session.passport.user.email);
  if (req.session.passport.user.userType == "admin") {
    res.render("admindashboard", {
      layout: "loginlayout",
      userId: req.session.passport.user,
    });
  } else {
    res.render("dashboard", {
      layout: "layout",
      userId: req.session.passport.user,
    });
  }
});

//Logout Handler
router.get("/logout", (req, res) => {
  req.logout();
  req.flash("success_msg", "You are logged Out");
  res.redirect("/");
});

router.get("/admin", checkAuthenicated, (req, res) => {
  res.render("admindashboard", {
    layout: "loginlayout",
    userId: req.session.passport.user,
  });
});

router.get("/showalluser", checkAuthenicated, async (req, res) => {
  res.render("showalluser", {
    layout: "loginlayout",
    userId: req.session.passport.user,
  });
});

router.get("/showalluserstatus", async (req, res) => {
  try {
    const users = await User.find({
      timestamp: { $lte: new Date(), $gte: new Date(Date() - 7) },
    }).lean();
    let info = [];
    users.map((user) =>
      info.push({ id: user._id, name: user.name, email: user.email })
    );
    res.status(200).json(info);
  } catch (err) {
    console.error(err);
  }
});

router.get("/adminshowallfiles", async (req, res) => {
  try {
    const infos = await Info.find().populate("userid", "name email").lean();
    // console.log(infos);
    let result = [];
    const infos1 = infos.map((info) =>
      info.dataUrl.map((test) =>
        test.url.map((test2) =>
          result.push({
            url: test2,
            filename: test2.split("/").pop(),
            email: info.userid.email,
            extname: test2.split(".").pop(),
            bucketname: test2.split(".")[0].split("//")[1],
            foldername: test2.split("/")[3],
            username: info.userid != null ? info.userid.name : "Default",
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

router.get("/adminallfiles", checkAuthenicated, async (req, res) => {
  res.render("showAllFiles", {
    layout: "loginlayout",
    userId: req.session.passport.user,
  });
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
            filename: test.split("/").pop().split(".")[0],
            extname: test.split("/").pop().split(".")[1],
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

router.get("/showalls3files", checkAuthenicated, async (req, res) => {
  // try {
  //   const info = await Info.find().populate("userid", "status").lean();
  //   // console.log(info);
  //   let result = [];
  //   info.map((data) => {
  //     // console.log(data);

  //     result.push({
  //       uid: data.userid,
  //       fname: data.dataUrl.map((url1) => url1.url),
  //       created_at: data.dataUrl.map((url) =>
  //         moment(url.created_at).format("YYYY-MM-DD")
  //       ),
  //     });
  //   });
  //   // console.log(result);
  //   let alldetails = await Promise.all(
  //     result.map((newres) => User.findById(newres.uid))
  //   );
  //   // console.log(alldetails);
  //   let mergeDetails = [];
  //   for (let i = 0; i < alldetails.length; i++) {
  //     result.find((res) => {
  //       if (alldetails[i] != null) {
  //         if (res.uid._id.equals(alldetails[i]._id)) {
  //           const newObj = {
  //             name: alldetails[i].name,
  //             email: alldetails[i].email,
  //             allfiles: res.fname,
  //             created_at: alldetails[i].createdAt,
  //           };
  //           mergeDetails.push(newObj);
  //           return newObj;
  //         }
  //       }
  //     });
  //   }
  //   // console.log(mergeDetails);
  //   let newresult = [];
  //   // console.log(mergeDetails);
  //   mergeDetails.map((md) =>
  //     md.allfiles.map((allfile) =>
  //       newresult.push({
  //         fname: allfile.map((af) => af.split("/").pop()),
  //         name: md.name,
  //         email: md.email,
  //         extname: allfile.map((af) => af.split(".").pop()),
  //         bucketname: allfile.map((af) => af.split(".")[0].split("//")[1]),
  //         foldername: allfile.map((af) => af.split("/")[3]),
  //         url: allfile,
  //         created_at: md.created_at,
  //       })
  //     )
  //   );
  //   // console.log(newresult);
  //   let newresult1 = [];
  //   newresult.map((newres) =>
  //     newres.url.map((newurl) =>
  //       newresult1.push({
  //         url: newurl,
  //         name: newres.name,
  //         email: newres.email,
  //         bucketname: newurl.split(".")[0].split("//")[1],
  //         foldername: newurl.split("/")[3],
  //         filename: newurl.split("/").pop().split(".")[0],
  //         extname: newurl.split(".").pop(),
  //         created_at: moment(newres.created_at).format("YYYY-MM-DD"),
  //       })
  //     )
  //   );
  //   console.log(newresult1);
  //   const buckets = new Map();
  //   newresult1.map((newresult = buckets.set(newresult.bucketname)));
  //   console.log(newresult1);
  //   res.render("history", {
  //     layout: "loginlayout",
  //     results: newresult1,
  //     userId: req.session.passport.user,
  //   });
  // } catch (err) {
  //   console.error(err);
  // }
  const s3 = new AWS.S3({
    accessKeyId: keyId,
    secretAccessKey: secretkey,
    region: region,
  });

  s3.listBuckets((err, data) => {
    console.log(data);
    if (err) {
      console.log("Error", err);
    } else {
      res.render("showalls3files", {
        buckets: data.Buckets,
        layout: "loginlayout",
        userId: req.session.passport.user,
      });
    }
  });
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
    User.findOne({ email: email }).then((user) => {
      if (user) {
        //User exists
        errors.push({ msg: "Email Already registered" });
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
      // for time stamp
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
    let searchparam = req.params.param;
    urlArry3.map((url) =>
      url.toLowerCase().indexOf(searchparam.toLowerCase()) != -1 ? count++ : ""
    );
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
    infos.map((info) =>
      info.dataUrl.map((test) =>
        test.url.map((link) =>
          result.push({
            url: link,
            name: link.split("/").pop(),
            extname: link.split(".").pop(),
            bucketname: link.split(".")[0].split("//")[1],
            foldername: link.split("/")[3],
            created_at: moment(test.created_at).format("YYYY-MM-DD"),
          })
        )
      )
    );
    // console.log(result);
    res.render("showSingleUser", {
      results: result,
      layout: "loginlayout",
      userId: req.session.passport.user,
    });
  } catch (error) {
    console.log(error);
  }
});

router.get("/deleteuser/:id", async (req, res) => {
  try {
    // const infos = await Info.findOneAndRemove({ userid: req.params.id });
    const users = await User.findOneAndUpdate(
      { _id: req.params.id },
      { status: true },
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

router.get("/usershowallfile", checkAuthenicated, (req, res) => {
  res.render("usershowallfile", {
    layout: "layout",
    userId: req.session.passport.user,
  });
});

router.get("/search/:filename", async (req, res) => {
  try {
    const filenames = await Info.find().populate("userid", "name email").lean();
    // console.log(filenames);
    let result = [];
    filenames.map((filename) =>
      filename.dataUrl.map((file) =>
        file.url.map((txt) => {
          if (
            txt
              .split("/")
              .pop()
              .split(".")[0]
              .toLowerCase()
              .indexOf(req.params.filename.toLowerCase()) != -1
          ) {
            result.push({
              username: filename.userid.name,
              email: filename.userid.email,
              createdAt: moment(file.created_at).format("YYYY-MM-DD"),
              filename: txt.split("/").pop().split(".")[0],
              extname: txt.split(".").pop(),
              foldername: txt.split("/")[3],
              bucketname: txt.split(".")[0].split("//")[1],
              test2: txt,
            });
          }
        })
      )
    );
    // console.log(result);
    res.status(200).json(result);
  } catch (error) {
    console.log(error);
  }
});

module.exports = router;
