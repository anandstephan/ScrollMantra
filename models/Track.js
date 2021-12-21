const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema.Types;

const TrackSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
    },
    bucketname: {
      type: String,
      required: true,
    },
    foldername: {
      type: String,
      required: true,
    },
    userid: {
      type: ObjectId,
      ref: "db1",
      required: true,
    },
  },
  { timestamps: true }
);

const Track = mongoose.model("Track", TrackSchema);
module.exports = Track;
