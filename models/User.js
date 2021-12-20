const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    userType: {
      type: String,
    },
    image: {
      type: String,
      default: "default.png",
    },
  },
  { timestamps: true }
);

const User = mongoose.model("db1", UserSchema);

module.exports = User;
