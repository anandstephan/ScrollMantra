const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const InfoSchema = new mongoose.Schema({
  userid: {
    type: ObjectId,
    ref: "db1",
    required: true,
  },
  dataUrl: {
    type: [
      {
        url: String,
        created_at: { type: Date, default: Date.now },
      },
    ],
  },
});

const Info = mongoose.model("Info", InfoSchema);

module.exports = Info;
