var s3 = require("s3-client");
const keyId = require("../config/key").accessKeyId;
const secret = require("../config/key").secretAccessKey;
const region = require("../config/key").region;

var client = s3.createClient({
  maxAsyncS3: 20, // this is the default
  s3RetryCount: 3, // this is the default
  s3RetryDelay: 1000, // this is the default
  multipartUploadThreshold: 20971520, // this is the default (20 MB)
  multipartUploadSize: 15728640, // this is the default (15 MB)
  s3Options: {
    accessKeyId: keyId,
    secretAccessKey: secret,
    region: region,
  },
});

var params = {
  localFile: "some/local/file",

  s3Params: {
    Bucket: "s3 bucket name",
    Key: "some/remote/file",
  },
};

const downloader = client.downloadFile(params);
downloader.on("error", function (err) {
  console.error("unable to download:", err.stack);
});
downloader.on("progress", function () {
  console.log("progress", downloader.progressAmount, downloader.progressTotal);
});
downloader.on("end", function () {
  console.log("done downloading");
});

module.exports = (parameter1) => downloadFile(parameter1);
