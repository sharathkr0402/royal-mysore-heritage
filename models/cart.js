const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  buyerId: { type: String },
  productId: { type: String },
  category: { type: String },
  name: { type: String },
  image: { type: String },
  price: { type: Number },
  per: { type: String },
  qty: { type: Number },
  rqty: { type: Number },
  seller: { type: String },
});

module.exports = mongoose.model("Cart", cartSchema);
