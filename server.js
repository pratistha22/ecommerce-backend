require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Order schema
const orderSchema = new mongoose.Schema({
  name: String,
  address: String,
  phone: String,
  items: Array,
  total: Number,
  date: String,
  status: { type: String, default: "Pending" },
});
const Order = mongoose.model("Order", orderSchema);

// Test route
app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// Owner login route
app.post("/api/login", (req, res) => {
  const { password } = req.body;

  if (password === process.env.OWNER_PASSWORD) {
    const token = jwt.sign({ role: "owner" }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Incorrect password" });
  }
});

// Create a new order (called at checkout)
app.post("/api/orders", async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: "Failed to save order" });
  }
});

// Get all orders (owner only, protected)
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ _id: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

// Update order status
app.patch("/api/orders/:id", async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: "Failed to update order" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));