const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  category: { type: String },
  name: { type: String },
  image: { type: String },
  price: { type: Number },
  per: { type: String },
  qty: { type: Number },
  description: { type: String },
  seller: { type: String },
});

module.exports = mongoose.model("Product", productSchema);
